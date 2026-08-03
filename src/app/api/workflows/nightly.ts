/**
 * The nightly run (WO-08) — the durable overnight workflow that makes the
 * demo narrative true: sync → triage → fan-out → meetings → opportunity
 * updates → morning brief. One parent agent_runs row (dedup-keyed per demo
 * day) with every step recorded as a workflow_step; child runs link via
 * workflow_run_id so <RunTrace /> renders the whole night.
 *
 * Idempotency: the parent dedup key (date of demo_now) makes a second
 * simulate on the same day a "nothing to process" no-op; step-level claims
 * (emails.is_processed, routing claim atomicity, meeting/PO idempotency)
 * make resume-after-crash duplicate-free. (Vercel Workflows-shaped — see
 * po-intake workflow note.)
 */
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { morningBriefAgent, type BriefPayload } from "@/agents/morning-brief";
import { opportunityUpdateAgent } from "@/agents/opportunity-update";
import { runTriageForEmail } from "@/agents/email-triage";
import { batchTriageEmails } from "@/agents/email-triage-batch";
import { db } from "@/db/client";
import { approvals, contacts, demoState, emails, meetings, morningBriefs, transcripts } from "@/db/schema";
import { RunRecorder } from "@/harness/run-recorder";
import { audit } from "@/lib/audit";
import { dayBounds, formatTimeShort, repDateKey, yesterdayBounds } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { batchApiEnabled } from "@/lib/ai/anthropic-batch";
import { dispatchTarget, type DispatchOutcome } from "@/lib/nightly-dispatch";
import { kpis } from "@/lib/queries/dashboard";
import { getCalendarProvider, getEmailProvider } from "@/providers";

export type NightlyResult =
  | { status: "noop"; reason: string }
  | {
      status: "completed";
      workflowRunId: string;
      counts: BriefPayload["counts"];
      skipped: { target: string; reason: string }[];
      elapsedMs: number;
    };

export async function nightlyRun(opts: { trigger: "cron" | "simulate" }): Promise<NightlyResult> {
  const t0 = Date.now();
  const demoNow = await getDemoNow();
  const dedupKey = `nightly:${repDateKey(demoNow)}`;

  // Parent run — the dedup key makes same-day re-invocations no-ops.
  let recorder: RunRecorder;
  try {
    recorder = await RunRecorder.start({
      agentName: "nightly-run",
      trigger: "nightly",
      input: { trigger: opts.trigger, demoDay: repDateKey(demoNow) },
      model: "workflow/orchestrator",
      dedupKey,
    });
  } catch {
    return { status: "noop", reason: "nothing to process — the nightly run already ran for this demo day" };
  }
  const workflowRunId = recorder.runId;
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const s0 = Date.now();
    const output = await fn();
    await recorder.step({ kind: "workflow_step", name, input: null, output, durationMs: Date.now() - s0 });
    return output;
  };

  try {
    // 1. syncInbox — provider pull of "yesterday's" unprocessed mail.
    const since = (await db.query.demoState.findFirst({ where: eq(demoState.id, 1) }))?.lastNightlyRunAt;
    const inbox = await getEmailProvider().listNewMessages(since ?? new Date(0));
    await step("syncInbox", async () => ({ newMessages: inbox.length }));

    // 2. triageAll — Message Batches when a direct Anthropic key is present
    //    (50% token cost; triage is single-shot classification, the canonical
    //    batch workload), else one granular, retry-safe serial run per message.
    let triaged = 0;
    let archived = 0;
    await step("triageAll", async () => {
      if (batchApiEnabled && inbox.length > 0) {
        try {
          const r = await batchTriageEmails(inbox.map((m) => m.id), { workflowRunId });
          triaged = r.triaged;
          archived = r.archived;
          return { triaged, archived, mode: "anthropic-batch", batchId: r.batchId, fellBackSerial: r.fellBackSerial };
        } catch (err) {
          // Batch didn't finish inside the wait budget (serverless maxDuration
          // caps how long we can poll) or failed outright — the batch is
          // cancelled upstream; degrade to serial and keep the night moving.
          const note = err instanceof Error ? err.message : String(err);
          for (const msg of inbox) {
            const { result } = await runTriageForEmail(msg.id, { trigger: "nightly", workflowRunId });
            if (result.status === "succeeded") {
              triaged += 1;
              if (result.output?.category === "noise") archived += 1;
            }
          }
          return { triaged, archived, mode: "serial-after-batch-timeout", note };
        }
      }
      for (const msg of inbox) {
        const { result } = await runTriageForEmail(msg.id, { trigger: "nightly", workflowRunId });
        if (result.status === "succeeded") {
          triaged += 1;
          if (result.output?.category === "noise") archived += 1;
        }
      }
      return { triaged, archived, mode: "serial" };
    });

    // 3. fanOut — registry dispatch per target; unmerged modules skip.
    const outcomes: DispatchOutcome[] = [];
    for (const target of ["quote", "po_intake", "sample", "submittal", "reply"] as const) {
      const res = await dispatchTarget(target, { workflowRunId });
      outcomes.push(...res);
      await step(`fanOut:${target}`, async () => summarizeOutcomes(res));
    }

    // 4. processMeetings — yesterday's transcribed-but-unprocessed meetings.
    const { start: yStart, end: yEnd } = yesterdayBounds(demoNow);
    const yesterdayMeetings = await db
      .select({ id: meetings.id, accountId: meetings.accountId, audio: transcripts.audioBlobUrl, summary: transcripts.summary })
      .from(meetings)
      .innerJoin(transcripts, eq(transcripts.meetingId, meetings.id))
      .where(and(gte(meetings.startsAt, yStart), lte(meetings.startsAt, yEnd)));
    const meetingAccountIds = new Set<string>();
    await step("processMeetings", async () => {
      const { startMeetingPipeline } = await import("@/app/api/workflows/transcribe/start");
      const results: Record<string, string> = {};
      for (const m of yesterdayMeetings) {
        if (m.accountId) meetingAccountIds.add(m.accountId);
        if (m.summary) {
          results[m.id] = "already_processed";
          continue;
        }
        const res = await startMeetingPipeline({
          meetingId: m.id,
          audioBlobUrl: m.audio ?? "",
          trigger: "nightly",
          workflowRunId,
        });
        results[m.id] = res.status;
      }
      return results;
    });

    // 5. updateOpportunities — once per account with yesterday activity
    //    (meeting-covered accounts are handled by the meeting pipeline).
    await step("updateOpportunities", async () => {
      const senders = await db
        .select({ fromEmail: emails.fromEmail })
        .from(emails)
        .where(and(eq(emails.direction, "inbound"), gte(emails.receivedAt, yStart), lte(emails.receivedAt, yEnd)));
      const senderEmails = [...new Set(senders.map((s) => s.fromEmail))];
      const senderContacts = senderEmails.length
        ? await db.select({ accountId: contacts.accountId }).from(contacts).where(inArray(contacts.email, senderEmails))
        : [];
      const accountIds = [...new Set(senderContacts.map((c) => c.accountId))].filter(
        (id) => !meetingAccountIds.has(id),
      );
      const results: Record<string, string> = {};
      for (const accountId of accountIds) {
        const res = await opportunityUpdateAgent.run(
          { accountId, sinceIso: yStart.toISOString() },
          { trigger: "nightly", workflowRunId },
        );
        results[accountId] = `${res.status}:${res.approvalIds.length}`;
      }
      return { accounts: accountIds.length, results };
    });

    // 6. assembleBrief — deterministic payload + model narrative.
    const briefPayload = await assembleBriefPayload(demoNow, { triaged, archived }, t0);
    const briefRun = await morningBriefAgent.run({ payload: briefPayload }, { trigger: "nightly", workflowRunId });
    const narrative =
      briefRun.status === "succeeded" && briefRun.output
        ? (briefRun.output as { narrative: string }).narrative
        : "The nightly run finished; review the approval queue.";
    await db.insert(morningBriefs).values({
      runId: workflowRunId,
      brief: { counts: briefPayload.counts, queueDigest: briefPayload.queueDigest, docket: briefPayload.docket, kpis: briefPayload.kpis, elapsedMs: Date.now() - t0 },
      narrative,
      briefDate: repDateKey(demoNow),
    });
    await step("assembleBrief", async () => ({ narrative: narrative.slice(0, 120) }));

    // 7. finalize.
    await db.update(demoState).set({ lastNightlyRunAt: demoNow }).where(eq(demoState.id, 1));
    const skipped = outcomes
      .filter((o): o is Extract<DispatchOutcome, { status: "skipped" }> => o.status === "skipped")
      .map((o) => ({ target: o.target, reason: o.reason }));
    await recorder.finalize({
      status: "succeeded",
      output: { counts: briefPayload.counts, skipped } as Record<string, unknown>,
    });
    await audit({
      actor: "system",
      action: "nightly.completed",
      objectType: "agent_run",
      objectId: workflowRunId,
      detail: { trigger: opts.trigger, counts: briefPayload.counts, elapsedMs: Date.now() - t0 },
    });
    return {
      status: "completed",
      workflowRunId,
      counts: briefPayload.counts,
      skipped,
      elapsedMs: Date.now() - t0,
    };
  } catch (err) {
    await recorder.finalize({
      status: "failed",
      output: { error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

function summarizeOutcomes(outcomes: DispatchOutcome[]): Record<string, unknown> {
  return {
    consumed: outcomes.filter((o) => o.status === "consumed").length,
    skipped: outcomes.filter((o) => o.status === "skipped").map((o) => (o.status === "skipped" ? o.reason : "")),
    failed: outcomes.filter((o) => o.status === "failed").map((o) => (o.status === "failed" ? o.error : "")),
    empty: outcomes.some((o) => o.status === "empty"),
  };
}

async function assembleBriefPayload(
  demoNow: Date,
  triage: { triaged: number; archived: number },
  t0: number,
): Promise<BriefPayload> {
  const pending = await db
    .select({ tier: approvals.riskTier, kind: approvals.kind, n: count() })
    .from(approvals)
    .where(eq(approvals.status, "pending"))
    .groupBy(approvals.riskTier, approvals.kind);

  const [poCounts] = await db.execute(sql`
    select
      count(*) filter (where status = 'converted')::int as validated,
      count(*) filter (where status = 'escalated')::int as escalated
    from purchase_orders
  `).then((r) => r.rows as { validated: number; escalated: number }[]);

  const drafts = pending.filter((p) => p.kind === "email_draft").reduce((a, p) => a + p.n, 0);
  const oppUpdates = pending.filter((p) => p.kind === "opportunity_update").reduce((a, p) => a + p.n, 0);
  const samples = pending.filter((p) => p.kind === "sample_order").reduce((a, p) => a + p.n, 0);
  const totalPending = pending.reduce((a, p) => a + p.n, 0);

  const { start, end } = dayBounds(demoNow);
  const docket = (await getCalendarProvider().listEvents({ start, end })).map((e) => ({
    time: formatTimeShort(e.startsAt),
    title: e.title,
    location: e.location,
  }));
  const k = await kpis();

  return {
    counts: {
      triaged: triage.triaged,
      archived: triage.archived,
      drafts,
      approvalsPending: totalPending,
      validatedPo: poCounts?.validated ?? 0,
      escalatedPo: poCounts?.escalated ?? 0,
      opportunityUpdates: oppUpdates,
      samples,
    },
    queueDigest: pending.map((p) => ({ tier: p.tier, kind: p.kind, count: p.n })),
    docket,
    kpis: {
      createdWkCents: k.createdWk.valueCents,
      targetWkCents: k.createdWk.targetCents,
      pacePct: Math.round((k.createdWk.valueCents / Math.max(1, k.createdWk.targetCents)) * 100),
    },
    elapsedMs: Date.now() - t0,
  };
}
