/**
 * Meeting pipeline (WO-07 task 3). Production: a durable Vercel Workflow;
 * locally a plain async orchestration. transcribe (diarized) → persist →
 * meeting-followup agent → deterministic validation → materialize approvals +
 * activity. The agent reads untrusted transcript with read-only tools; the
 * WORKFLOW creates the approvals (trifecta separation). Idempotent per meeting.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, assets, contacts, meetings, pdsDocuments, transcripts, type ActionItem, type Evidence } from "@/db/schema";
import { meetingFollowupAgent, type MeetingFollowupOutput } from "@/agents/meeting-followup";
import { createApprovalRow } from "@/harness/approvals";
import { EscalationError } from "@/harness/errors";
import { audit } from "@/lib/audit";
import { getDemoNow } from "@/lib/demo-clock";
import { getTranscriptionProvider } from "@/providers";

export type MeetingPipelineResult = {
  meetingId: string;
  status: "drafted" | "escalated" | "skipped";
  runId: string | null;
  approvalIds: string[];
};

export async function meetingPipeline(meetingId: string, audioBlobUrl?: string): Promise<MeetingPipelineResult> {
  const demoNow = await getDemoNow();

  // Idempotency: a prior follow-up for this meeting → skip.
  const priorActivity = await db.select({ id: activities.id }).from(activities).where(and(eq(activities.refType, "meeting_followup"), eq(activities.refId, meetingId)));
  if (priorActivity.length > 0) return { meetingId, status: "skipped", runId: null, approvalIds: [] };

  // Step 1 — transcribe (Demo = pre-baked diarized fixture).
  const existing = await db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, meetingId) });
  let segments = existing?.segments ?? [];
  if (segments.length === 0 || audioBlobUrl) {
    const { segments: fresh } = await getTranscriptionProvider().transcribe(audioBlobUrl ?? existing?.audioBlobUrl ?? "");
    segments = fresh;
    if (existing) await db.update(transcripts).set({ segments, audioBlobUrl: audioBlobUrl ?? existing.audioBlobUrl }).where(eq(transcripts.id, existing.id));
    else await db.insert(transcripts).values({ meetingId, audioBlobUrl: audioBlobUrl ?? null, segments });
  }

  // Step 2 — meeting-followup agent.
  const run = await meetingFollowupAgent.run({ meetingId }, { trigger: audioBlobUrl ? "user" : "nightly" });
  if (run.status !== "succeeded" || !run.output) {
    await audit({ actor: "system", action: "meeting.escalated", objectType: "meeting", objectId: meetingId, detail: { reason: run.escalation?.reason } });
    return { meetingId, status: "escalated", runId: run.runId, approvalIds: run.approvalIds };
  }
  const out = run.output as MeetingFollowupOutput;

  // Step 3 — deterministic validation (grounded or it escalates).
  const attIds = out.follow_up_email.attachment_pds_ids;
  if (attIds.length > 0) {
    const pds = await db.select({ id: pdsDocuments.id }).from(pdsDocuments).where(inArray(pdsDocuments.id, attIds));
    const asset = await db.select({ id: assets.id }).from(assets).where(inArray(assets.id, attIds));
    const known = new Set([...pds.map((r) => r.id), ...asset.map((r) => r.id)]);
    if (attIds.some((id) => !known.has(id))) {
      await audit({ actor: "system", action: "meeting.escalated", objectType: "meeting", objectId: meetingId, detail: { reason: "attachment_not_in_library" } });
      throw new EscalationError("attachment_not_in_library", { attIds });
    }
  }
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, meetingId) });
  const attendees = meeting?.accountId ? await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.accountId, meeting.accountId)) : [];
  const attendeeEmails = new Set(attendees.map((a) => a.email.toLowerCase()));
  for (const r of [...out.follow_up_email.to, ...out.follow_up_email.cc]) {
    if (!attendeeEmails.has(r.toLowerCase())) throw new EscalationError("recipient_not_attendee", { recipient: r });
  }

  // Step 4 — materialize.
  const segEvidence = (refs: number[]): Evidence[] => refs.map((i) => ({ type: "transcript_segment", ref: { meetingId, segment: i }, quote: (segments[i]?.text ?? `segment ${i}`).slice(0, 120) }));
  const actionItems: ActionItem[] = out.action_items.map((a) => ({ text: a.text, owner: a.owner, dueHint: a.due_hint, segmentRefs: a.segment_refs }));
  await db.update(transcripts).set({ summary: out.summary.map((s) => s.text).join("\n"), actionItems }).where(eq(transcripts.meetingId, meetingId));
  await db.insert(activities).values({
    type: "meeting",
    accountId: meeting?.accountId ?? null,
    refType: "meeting_followup",
    refId: meetingId,
    summary: `Follow-up drafted: ${out.summary.length} points, ${out.action_items.length} action items`,
    detail: { opportunityUpdates: out.opportunity_updates.length },
    occurredAt: meeting?.endsAt ?? demoNow,
  });

  const approvalIds: string[] = [];
  // opportunity_update approvals.
  for (const upd of out.opportunity_updates) {
    const { approvalId } = await createApprovalRow({
      runId: run.runId,
      agentName: "meeting-followup",
      kind: "opportunity_update",
      proposedAction: {
        accountId: meeting?.accountId,
        accountName: (await db.query.accounts.findFirst({ where: (a, { eq: e }) => e(a.id, meeting!.accountId!) }))?.name,
        opportunityId: upd.opportunity_id,
        newOpportunity: upd.new_opportunity ? { name: upd.new_opportunity.name, stage: upd.new_opportunity.stage, valueCents: upd.new_opportunity.value_cents, projectHint: upd.new_opportunity.project_hint } : undefined,
        fieldDiffs: upd.field_diffs,
        rationale: upd.new_opportunity ? `From ${meeting?.title}: ${upd.new_opportunity.project_hint}` : `Meeting update`,
      },
      evidence: segEvidence(upd.segment_refs),
      demoNow,
      riskTier: "standard",
    });
    approvalIds.push(approvalId);
  }
  // follow-up email_draft approval.
  const em = out.follow_up_email;
  const { approvalId } = await createApprovalRow({
    runId: run.runId,
    agentName: "meeting-followup",
    kind: "email_draft",
    proposedAction: { to: em.to, cc: em.cc, subject: em.subject, bodyText: em.body_markdown, attachmentAssetIds: em.attachment_pds_ids, intent: "meeting_followup" },
    evidence: [...segEvidence(em.segment_refs), ...run.evidence.filter((e) => e.type === "price_row")],
    demoNow,
    riskTier: "standard",
  });
  approvalIds.push(approvalId);

  await audit({ actor: "system", action: "meeting.followup_drafted", objectType: "meeting", objectId: meetingId, detail: { approvals: approvalIds.length } });
  return { meetingId, status: "drafted", runId: run.runId, approvalIds };
}
