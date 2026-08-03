/**
 * WO-07 acceptance: the seeded Monday Harborview meeting yields summary +
 * action items + the Phase 3 opportunity proposal + a follow-up draft with
 * exactly the two Walnut Grain docs and the correct tier price; read-only
 * allowlist; deterministic validation escalates on tampering; idempotent
 * re-runs.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, pdsDocuments, transcripts } from "@/db/schema";
import { agents } from "@/agents";
import type { MeetingFollowupOutput } from "@/agents/meeting-followup";
import { startMeetingPipeline } from "@/app/api/workflows/transcribe/start";
import { validateFollowupOutput } from "@/app/api/workflows/transcribe/workflow";
import { EscalationError } from "@/harness/errors";
import { formatCentsExact } from "@/lib/money";
import { priceLines } from "@/lib/pricing";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { sid } from "@/db/seed/ids";
import { skuOf } from "@/db/seed/data/catalog";
import { DEMO_NOW } from "@/db/seed/scenario";

const MEETING_ID = sid("meeting:mtg-harborview-walk");
const WHITAKER = sid("account:gc-whitaker");

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  // Reset any prior pipeline residue for this meeting.
  await db.execute(sql`delete from approvals where proposed_action ->> 'meetingId' = ${MEETING_ID}`);
  await db.execute(sql`delete from activities where ref_id = ${MEETING_ID} and ref_type = 'meeting_followup'`);
  await db
    .update(transcripts)
    .set({ summary: null, actionItems: null })
    .where(eq(transcripts.meetingId, MEETING_ID));
  await db.execute(
    sql`delete from opportunities where name = 'Harborview Medical Ph3 — Outpatient Wing (planning)'`,
  );
});

describe("meeting-followup agent shape", () => {
  it("tool allowlist is read-only (trifecta: ingests untrusted transcripts)", () => {
    const agent = agents["meeting-followup"]!;
    expect(agent.tools.every((t) => t.effect === "read")).toBe(true);
    expect(agent.tools.length).toBeGreaterThanOrEqual(5);
  });
});

describe("Harborview Monday meeting end to end", () => {
  it("pipeline yields summary, actions, Phase 3 proposal, and the grounded follow-up draft", async () => {
    const result = await startMeetingPipeline({
      meetingId: MEETING_ID,
      audioBlobUrl: "/api/blob/fixtures/harborview-walk.wav",
      trigger: "user",
    });
    expect(result.status).toBe("succeeded");
    expect(result.approvalIds.length).toBeGreaterThanOrEqual(3); // 2 opp updates + follow-up draft

    const t = (await db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, MEETING_ID) }))!;
    expect(t.summary).toBeTruthy();
    expect(t.actionItems!.length).toBeGreaterThanOrEqual(3);

    const rows = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.status, "pending"), sql`${approvals.proposedAction} ->> 'meetingId' = ${MEETING_ID}`));

    // Phase 3 new-opportunity proposal with a __create__ diff.
    const oppUpdates = rows.filter((r) => r.kind === "opportunity_update");
    expect(oppUpdates.length).toBeGreaterThanOrEqual(2);
    const phase3 = oppUpdates.find((r) =>
      JSON.stringify(r.proposedAction).includes("Harborview Medical Ph3"),
    )!;
    expect(phase3).toBeTruthy();
    const diffs = (phase3.proposedAction as { fieldDiffs: { field: string }[] }).fieldDiffs;
    expect(diffs.some((d) => d.field === "__create__")).toBe(true);
    expect(phase3.evidence.some((e) => e.type === "transcript_segment")).toBe(true);

    // Follow-up draft: exactly the 2 Walnut Grain docs (pds + install), correct tier price.
    const draft = rows.find((r) => r.kind === "email_draft")!;
    const payload = draft.proposedAction as { attachmentAssetIds: string[]; bodyText: string; to: string[]; cc: string[] };
    const walnut = skuOf("Walnut Grain");
    const walnutDocs = await db
      .select({ id: pdsDocuments.id, kind: pdsDocuments.kind })
      .from(pdsDocuments)
      .where(eq(pdsDocuments.productId, sid(`product:${walnut}`)));
    const pdsId = walnutDocs.find((d) => d.kind === "pds")!.id;
    const installId = walnutDocs.find((d) => d.kind === "install")!.id;
    expect([...payload.attachmentAssetIds].sort()).toEqual([pdsId, installId].sort());

    const priced = await priceLines(WHITAKER, [{ productId: sid(`product:${walnut}`), qty: 1 }]);
    expect(payload.bodyText).toContain(formatCentsExact(priced.lines[0]!.unitPriceCents));
    expect(draft.evidence.some((e) => e.type === "price_row")).toBe(true);
    expect(draft.evidence.some((e) => e.type === "transcript_segment")).toBe(true);
    expect(payload.bodyText).toContain("—Cole");
    expect(payload.to[0]).toContain("ray.delgado");
  });

  it("re-running the pipeline is a no-op (no duplicate approvals/activities)", async () => {
    const before = await db.$count(approvals);
    const result = await startMeetingPipeline({
      meetingId: MEETING_ID,
      audioBlobUrl: "/api/blob/fixtures/harborview-walk.wav",
      trigger: "user",
    });
    expect(result.status).toBe("noop");
    expect(await db.$count(approvals)).toBe(before);
  });
});

describe("deterministic validation escalates on tampering", () => {
  const base = (): MeetingFollowupOutput => ({
    summary: [{ text: "x", segment_refs: [0] }],
    action_items: [{ text: "x", owner: "rep", due_hint: null, segment_refs: [0] }],
    opportunity_updates: [],
    follow_up_email: {
      to: ["ray.delgado@whitakercommercial.example.com"],
      cc: [],
      subject: "x",
      body_markdown: "no prices here",
      attachment_pds_ids: [],
      segment_refs: [0],
    },
  });

  it("hallucinated attachment id", async () => {
    const out = base();
    out.follow_up_email.attachment_pds_ids = ["11111111-1111-4111-8111-111111111111"];
    await expect(validateFollowupOutput(out, WHITAKER, 16, [])).rejects.toThrow(EscalationError);
  });

  it("recipient outside meeting attendees", async () => {
    const out = base();
    out.follow_up_email.to = ["attacker@evil.example.net"];
    await expect(validateFollowupOutput(out, WHITAKER, 16, [])).rejects.toThrow(EscalationError);
  });

  it("segment ref out of bounds", async () => {
    const out = base();
    out.summary[0]!.segment_refs = [99];
    await expect(validateFollowupOutput(out, WHITAKER, 16, [])).rejects.toThrow(EscalationError);
  });

  it("ungrounded price in the draft", async () => {
    const out = base();
    out.follow_up_email.body_markdown = "Special price just for you: $1.00";
    await expect(validateFollowupOutput(out, WHITAKER, 16, [])).rejects.toThrow(EscalationError);
  });
});
