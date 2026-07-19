/**
 * Meeting pipeline (WO-07, docs/01 §3): audio → diarized transcript →
 * meeting-followup agent → deterministic validation → materialized approvals
 * + activity. Idempotent per meeting: an already-materialized meeting is a
 * no-op. (Vercel Workflows-shaped; see po-intake workflow note.)
 */
import { and, eq, sql } from "drizzle-orm";
import { meetingFollowupAgent, type MeetingFollowupOutput } from "@/agents/meeting-followup";
import { db } from "@/db/client";
import {
  activities,
  approvals,
  assets,
  contacts,
  meetings,
  pdsDocuments,
  priceListItems,
  transcripts,
} from "@/db/schema";
import { createApprovalRow } from "@/harness/approvals";
import { EscalationError } from "@/harness/errors";
import { audit } from "@/lib/audit";
import { getDemoNow } from "@/lib/demo-clock";
import { formatCentsExact } from "@/lib/money";
import { getTranscriptionProvider } from "@/providers";

export type MeetingPipelineResult = {
  meetingId: string;
  status: "succeeded" | "escalated" | "noop";
  runId: string | null;
  approvalIds: string[];
  summaryBullets: number;
};

export async function meetingPipeline(
  meetingId: string,
  audioBlobUrl: string,
  opts?: { trigger?: "nightly" | "user" | "workflow"; workflowRunId?: string },
): Promise<MeetingPipelineResult> {
  const trigger = opts?.trigger ?? "user";
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  if (!meeting) throw new Error(`meeting ${meetingId} not found`);

  // Idempotency: pending approvals for this meeting ⇒ already materialized.
  const existing = await db
    .select({ id: approvals.id })
    .from(approvals)
    .where(and(eq(approvals.status, "pending"), sql`${approvals.proposedAction} ->> 'meetingId' = ${meetingId}`));
  if (existing.length > 0) {
    return { meetingId, status: "noop", runId: null, approvalIds: existing.map((e) => e.id), summaryBullets: 0 };
  }

  // Step 1: transcribeAudio (Demo = pre-baked diarized fixture).
  const { segments } = await getTranscriptionProvider().transcribe(audioBlobUrl);
  await db
    .insert(transcripts)
    .values({ meetingId, audioBlobUrl, segments })
    .onConflictDoUpdate({ target: transcripts.meetingId, set: { audioBlobUrl, segments } });
  await audit({ actor: "system", action: "meeting.transcribed", objectType: "meeting", objectId: meetingId, detail: { segments: segments.length } });

  // Step 2: runFollowupAgent (transcript enters the prompt untrusted-wrapped).
  const runResult = await meetingFollowupAgent.run(
    { meetingId, transcript: segments },
    { trigger, workflowRunId: opts?.workflowRunId },
  );
  if (runResult.status !== "succeeded" || !runResult.output) {
    const demoNow = await getDemoNow();
    const { approvalId } = await createApprovalRow({
      runId: runResult.runId,
      agentName: "meeting-followup",
      kind: "email_draft",
      proposedAction: {
        meetingId,
        escalation: runResult.escalation ?? { reason: "followup_failed", detail: {} },
      },
      evidence: runResult.evidence,
      demoNow,
      riskTier: "standard",
    });
    await db.update(meetings).set({ status: "completed" }).where(eq(meetings.id, meetingId));
    return { meetingId, status: "escalated", runId: runResult.runId, approvalIds: [approvalId], summaryBullets: 0 };
  }
  const out = runResult.output as MeetingFollowupOutput;

  // Step 3: validateOutput — deterministic code, escalate on any failure.
  try {
    await validateFollowupOutput(out, meeting.accountId, segments.length, runResult.evidence);
  } catch (err) {
    if (err instanceof EscalationError) {
      const demoNow = await getDemoNow();
      const { approvalId } = await createApprovalRow({
        runId: runResult.runId,
        agentName: "meeting-followup",
        kind: "email_draft",
        proposedAction: { meetingId, escalation: { reason: err.reason, detail: err.detail } },
        evidence: runResult.evidence,
        demoNow,
        riskTier: "standard",
      });
      await audit({
        actor: "system",
        action: "meeting.followup.escalated",
        objectType: "meeting",
        objectId: meetingId,
        detail: { reason: err.reason },
      });
      return { meetingId, status: "escalated", runId: runResult.runId, approvalIds: [approvalId], summaryBullets: 0 };
    }
    throw err;
  }

  // Step 4: materialize — transcript summary/actions, activity, approvals.
  const demoNow = await getDemoNow();
  await db
    .update(transcripts)
    .set({
      summary: out.summary.map((s) => s.text).join("\n"),
      actionItems: out.action_items.map((a) => ({
        text: a.text,
        owner: a.owner,
        dueHint: a.due_hint,
        segmentRefs: a.segment_refs,
      })),
    })
    .where(eq(transcripts.meetingId, meetingId));
  await db.update(meetings).set({ status: "completed" }).where(eq(meetings.id, meetingId));
  await db.insert(activities).values({
    type: "meeting",
    accountId: meeting.accountId,
    refType: "meeting_followup",
    refId: meetingId,
    summary: `Meeting processed: ${meeting.title} — ${out.summary[0]?.text ?? ""}`,
    detail: { actionItems: out.action_items.length },
    occurredAt: meeting.endsAt,
  });

  const approvalIds: string[] = [];
  const account = meeting.accountId
    ? await db.query.accounts.findFirst({ where: (t, { eq: e }) => e(t.id, meeting.accountId!) })
    : null;

  for (const u of out.opportunity_updates) {
    const { approvalId } = await createApprovalRow({
      runId: runResult.runId,
      agentName: "meeting-followup",
      kind: "opportunity_update",
      proposedAction: {
        meetingId,
        accountId: meeting.accountId,
        accountName: account?.name,
        opportunityId: u.opportunity_id,
        newOpportunity: u.new_opportunity
          ? {
              name: u.new_opportunity.name,
              stage: u.new_opportunity.stage,
              valueCents: u.new_opportunity.value_cents,
              projectHint: u.new_opportunity.project_hint,
            }
          : undefined,
        fieldDiffs: u.field_diffs,
        rationale: `From the ${meeting.title} transcript`,
      },
      evidence: u.segment_refs.map((i) => ({
        type: "transcript_segment" as const,
        ref: { meetingId, segment: i },
        quote: segments[i]?.text.slice(0, 80) ?? "",
      })),
      demoNow,
      riskTier: "standard",
    });
    approvalIds.push(approvalId);
  }

  const draftEvidence = [
    ...out.follow_up_email.segment_refs.map((i) => ({
      type: "transcript_segment" as const,
      ref: { meetingId, segment: i },
      quote: segments[i]?.text.slice(0, 80) ?? "",
    })),
    ...runResult.evidence.filter((e) => e.type === "price_row"),
  ];
  const { approvalId: draftApprovalId } = await createApprovalRow({
    runId: runResult.runId,
    agentName: "meeting-followup",
    kind: "email_draft",
    proposedAction: {
      meetingId,
      to: out.follow_up_email.to,
      cc: out.follow_up_email.cc,
      subject: out.follow_up_email.subject,
      bodyText: out.follow_up_email.body_markdown,
      attachmentAssetIds: out.follow_up_email.attachment_pds_ids,
    },
    evidence: draftEvidence,
    demoNow,
  });
  approvalIds.push(draftApprovalId);

  await audit({
    actor: "system",
    action: "meeting.followup.materialized",
    objectType: "meeting",
    objectId: meetingId,
    detail: { approvals: approvalIds.length },
  });
  return {
    meetingId,
    status: "succeeded",
    runId: runResult.runId,
    approvalIds,
    summaryBullets: out.summary.length,
  };
}

/**
 * Deterministic validation (WO-07 task 3.3): hallucinated attachment ids,
 * out-of-attendee recipients, missing segment refs, or draft prices that
 * don't match tool-returned price rows all escalate — never a silent fix.
 */
export async function validateFollowupOutput(
  out: MeetingFollowupOutput,
  accountId: string | null,
  segmentCount: number,
  runEvidence: { type: string; ref: Record<string, unknown> }[],
): Promise<void> {
  // Attachments must exist in the document/asset library.
  for (const id of out.follow_up_email.attachment_pds_ids) {
    const doc = await db.query.pdsDocuments.findFirst({ where: eq(pdsDocuments.id, id) });
    const asset = doc ? null : await db.query.assets.findFirst({ where: eq(assets.id, id) });
    if (!doc && !asset) throw new EscalationError("attachment_not_in_library", { id });
  }
  // Recipients must be meeting attendees (contacts of the meeting account).
  const attendeeEmails = accountId
    ? new Set((await db.query.contacts.findMany({ where: eq(contacts.accountId, accountId) })).map((c) => c.email))
    : new Set<string>();
  for (const r of [...out.follow_up_email.to, ...out.follow_up_email.cc]) {
    if (!attendeeEmails.has(r.toLowerCase())) {
      throw new EscalationError("recipient_not_attendee", { recipient: r });
    }
  }
  // Every element must carry in-bounds segment refs.
  const allRefs = [
    ...out.summary.flatMap((s) => s.segment_refs),
    ...out.action_items.flatMap((a) => a.segment_refs),
    ...out.opportunity_updates.flatMap((u) => u.segment_refs),
    ...out.follow_up_email.segment_refs,
  ];
  for (const ref of allRefs) {
    if (ref < 0 || ref >= segmentCount) throw new EscalationError("segment_ref_out_of_bounds", { ref, segmentCount });
  }
  // Draft prices must match tool-returned price rows exactly (string match).
  const priceRefs = runEvidence.filter((e) => e.type === "price_row");
  const legalPrices = new Set<string>();
  for (const e of priceRefs) {
    const id = e.ref.priceListItemId;
    if (typeof id === "string") {
      const row = await db.query.priceListItems.findFirst({ where: eq(priceListItems.id, id) });
      if (row) legalPrices.add(formatCentsExact(row.unitPriceCents));
    }
  }
  const priceTokens = out.follow_up_email.body_markdown.match(/\$[\d,]+\.\d{2}/g) ?? [];
  for (const token of priceTokens) {
    if (!legalPrices.has(token)) {
      throw new EscalationError("price_not_grounded", { token, legal: [...legalPrices] });
    }
  }
}
