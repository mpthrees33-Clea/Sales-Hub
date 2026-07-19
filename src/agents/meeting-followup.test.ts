/**
 * WO-07 acceptance: meeting-followup is read-only (trifecta separation); the
 * seeded Harborview meeting yields a follow-up email_draft with exactly the two
 * Walnut Grain PDS attachments, tier pricing, segment + price_row evidence, plus
 * a Phase 3 opportunity_update; the pipeline is idempotent.
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, pdsDocuments, products } from "@/db/schema";
import { meetingFollowupAgent } from "@/agents/meeting-followup";
import { startMeetingPipeline } from "@/app/api/workflows/transcribe/start";
import { sid } from "@/db/seed/ids";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("meeting-followup", () => {
  it("holds read-effect tools only (trifecta separation)", () => {
    expect(meetingFollowupAgent.tools.every((t) => t.effect === "read")).toBe(true);
    expect(meetingFollowupAgent.tools.length).toBeGreaterThanOrEqual(5);
  });

  it("drafts the Harborview follow-up with 2 PDS attachments + Phase 3 opportunity", async () => {
    const meetingId = sid("meeting:mtg-harborview-walk");
    const r = await startMeetingPipeline({ meetingId });
    expect(r.status).toBe("drafted");
    expect(r.approvalIds.length).toBe(2);

    const apprs = await Promise.all(r.approvalIds.map((id) => db.query.approvals.findFirst({ where: eq(approvals.id, id) })));
    const email = apprs.find((a) => a?.kind === "email_draft")!;
    const opp = apprs.find((a) => a?.kind === "opportunity_update")!;

    const [walnut] = await db.select({ id: products.id }).from(products).where(eq(products.sku, "MS-WG-1147"));
    const docs = await db.select().from(pdsDocuments).where(eq(pdsDocuments.productId, walnut!.id));
    const expected = docs.filter((d) => d.kind === "pds" || d.kind === "install").map((d) => d.id).sort();
    const got = ((email.proposedAction as { attachmentAssetIds?: string[] }).attachmentAssetIds ?? []).sort();
    expect(got).toEqual(expected);

    const types = new Set(email.evidence.map((e) => e.type));
    expect(types.has("transcript_segment")).toBe(true);
    expect(types.has("price_row")).toBe(true);

    expect((opp.proposedAction as { newOpportunity?: { name?: string } }).newOpportunity?.name).toContain("Ph3");
    expect(opp.evidence.every((e) => e.type === "transcript_segment")).toBe(true);
  });

  it("is idempotent — a second run skips", async () => {
    const meetingId = sid("meeting:mtg-harborview-walk");
    const r = await startMeetingPipeline({ meetingId });
    expect(r.status).toBe("skipped");
  });
});
