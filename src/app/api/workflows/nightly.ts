/**
 * The nightly run (WO-08) — the flagship multi-agent orchestration that makes
 * the demo narrative true. Production: a durable Vercel Workflow; locally a
 * plain async orchestration. syncInbox → triage → fan-out → opportunity updates
 * (emails + Monday meetings) → morning brief. Produces only approvals + a brief;
 * executes nothing external. Idempotent per demo-day (keyed on is_processed +
 * routing-claim atomicity). A parent agent_runs row links every child via
 * workflow_run_id.
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, agentRuns, agentSteps, approvals, contacts, emails, meetings, morningBriefs, purchaseOrders, transcripts, triageRoutings } from "@/db/schema";
import { triageEmail } from "@/agents/email-triage";
import { opportunityUpdateAgent } from "@/agents/opportunity-update";
import { morningBriefAgent } from "@/agents/morning-brief";
import { startMeetingPipeline } from "@/app/api/workflows/transcribe/start";
import { dispatchRouting } from "@/lib/nightly-dispatch";
import { getCalendarProvider, getEmailProvider } from "@/providers";
import { audit } from "@/lib/audit";
import { getDemoNow, getDemoStateRow } from "@/lib/demo-clock";
import { dayBounds, repDateKey } from "@/lib/dates";
import { setDemoNow } from "@/lib/demo-clock";
import { DEMO_MODEL_ID } from "@/lib/ai/models";
import { demoState } from "@/db/schema";

export type NightlyResult = {
  workflowRunId: string;
  processed: number;
  triaged: number;
  fanOut: { target: string; status: string }[];
  opportunityUpdates: number;
  briefId: string | null;
  note?: string;
};

export async function nightlyRun(opts: { trigger: "cron" | "simulate" }): Promise<NightlyResult> {
  const demoNow = await getDemoNow();
  const state = await getDemoStateRow();
  const workflowRunId = `nightly-${repDateKey(demoNow)}`;

  // Idempotency guard — nothing unprocessed ⇒ no-op.
  const since = state.lastNightlyRunAt ?? new Date(0);
  const unprocessed = await getEmailProvider().listNewMessages(since);
  if (unprocessed.length === 0) {
    return { workflowRunId, processed: 0, triaged: 0, fanOut: [], opportunityUpdates: 0, briefId: null, note: "nothing to process" };
  }

  // Parent run.
  const [parent] = await db
    .insert(agentRuns)
    .values({ agentName: "nightly-run", trigger: "nightly", input: { trigger: opts.trigger }, model: DEMO_MODEL_ID, status: "running", workflowRunId })
    .returning({ id: agentRuns.id });
  const parentId = parent!.id;
  let seq = 0;
  const step = (name: string, output: Record<string, unknown>, ms = 20) => db.insert(agentSteps).values({ runId: parentId, seq: ++seq, kind: "workflow_step", name, input: null, output, durationMs: ms });

  await audit({ actor: "system", action: "nightly.started", objectType: "agent_run", objectId: parentId, detail: { trigger: opts.trigger } });
  await step("syncInbox", { newMessages: unprocessed.length });

  // 2 — triage.
  let triaged = 0;
  for (const m of unprocessed) {
    await triageEmail(m.id, { trigger: "nightly", workflowRunId });
    triaged++;
  }
  await step("triageAll", { triaged });

  // 3 — fan-out per pending routing.
  const routings = await db.select().from(triageRoutings).where(eq(triageRoutings.status, "pending"));
  const fanOut: { target: string; status: string }[] = [];
  for (const r of routings) {
    const res = await dispatchRouting(r);
    fanOut.push({ target: res.target, status: res.status });
    await step(`fanOut:${res.target}`, { routingId: r.id, status: res.status, detail: res.detail });
  }

  // 4 — opportunity updates from yesterday's emails + Monday meetings.
  const yesterday = dayBounds(new Date(demoNow.getTime() - 86_400_000));
  // Completed meetings that actually have a diarized transcript → meeting pipeline.
  const mondayMeetings = await db
    .select({ id: meetings.id })
    .from(meetings)
    .innerJoin(transcripts, eq(transcripts.meetingId, meetings.id))
    .where(eq(meetings.status, "completed"));
  for (const mm of mondayMeetings) {
    const r = await startMeetingPipeline({ meetingId: mm.id });
    await step(`meeting:${mm.id.slice(0, 8)}`, { status: r.status, approvals: r.approvalIds.length });
  }
  // Accounts with yesterday inbound activity.
  const yEmails = await db.select({ fromEmail: emails.fromEmail }).from(emails).where(and(eq(emails.direction, "inbound"), gte(emails.receivedAt, yesterday.start))).orderBy(desc(emails.receivedAt));
  const acctByEmail = await db.select({ email: contacts.email, accountId: accounts.id }).from(contacts).innerJoin(accounts, eq(accounts.id, contacts.accountId));
  const acctOf = new Map(acctByEmail.map((r) => [r.email, r.accountId]));
  const accountIds = [...new Set(yEmails.map((e) => acctOf.get(e.fromEmail)).filter((v): v is string => !!v))];
  let opportunityUpdates = 0;
  for (const accountId of accountIds) {
    const run = await opportunityUpdateAgent.run({ accountId, sinceIso: yesterday.start.toISOString() }, { trigger: "nightly", workflowRunId });
    opportunityUpdates += run.approvalIds.length;
  }
  await step("updateOpportunities", { accounts: accountIds.length, updates: opportunityUpdates });

  // 5 — morning brief.
  const [pending] = await db.select({ n: approvals.id }).from(approvals).where(eq(approvals.status, "pending"));
  const pendingCount = (await db.select().from(approvals).where(eq(approvals.status, "pending"))).length;
  const drafts = (await db.select().from(approvals).where(and(eq(approvals.kind, "email_draft"), eq(approvals.status, "pending")))).length;
  const poRows = await db.select({ status: purchaseOrders.status }).from(purchaseOrders);
  const validatedPo = poRows.filter((p) => p.status === "converted").length;
  const escalatedPo = poRows.filter((p) => p.status === "escalated").length;
  const archived = (await db.select({ id: triageRoutings.id }).from(triageRoutings).where(eq(triageRoutings.target, "none"))).length;
  const day = dayBounds(demoNow);
  const docket = await getCalendarProvider().listEvents({ start: day.start, end: day.end });

  const briefRun = await morningBriefAgent.run(
    { counts: { triaged, archived, drafts, approvalsPending: pendingCount, validatedPo, escalatedPo }, docketCount: docket.length, elapsedMs: 22 * 60_000 },
    { trigger: "nightly", workflowRunId },
  );
  const narrative = (briefRun.output as { narrative?: string } | undefined)?.narrative ?? "Overnight run complete.";
  const [brief] = await db
    .insert(morningBriefs)
    .values({ runId: briefRun.runId, briefDate: repDateKey(demoNow), narrative, brief: { counts: { triaged, archived, drafts, approvalsPending: pendingCount, validatedPo, escalatedPo }, elapsedMs: 22 * 60_000 } })
    .returning({ id: morningBriefs.id });
  await step("assembleBrief", { briefId: brief!.id, pending: pendingCount });
  void pending;

  // 6 — finalize.
  await setDemoNow(demoNow); // keep clock; ensures cache flush
  await db.update(demoState).set({ lastNightlyRunAt: demoNow }).where(eq(demoState.id, 1));
  await db.update(agentRuns).set({ status: "succeeded", finishedAt: new Date(), output: { triaged, fanOut: fanOut.length, opportunityUpdates, pending: pendingCount } }).where(eq(agentRuns.id, parentId));
  await audit({ actor: "system", action: "nightly.finished", objectType: "agent_run", objectId: parentId, detail: { triaged, pending: pendingCount, validatedPo, escalatedPo } });

  return { workflowRunId, processed: unprocessed.length, triaged, fanOut, opportunityUpdates, briefId: brief!.id };
}
