/**
 * WO-03 acceptance for the resolution core (the only executor):
 *  - rejecting never calls the gate or a provider (no side effects)
 *  - expired approvals never execute
 *  - the policy gate re-runs at execution time; a block leaves status pending +
 *    writes a policy.blocked audit row; nothing executes
 *  - editing then approving records the diff and sets edited_approved
 *  - approving executes exactly once through the provider (email appended) with
 *    approval.approved + effect.executed audit rows
 *  - batch approve refuses non-low tier server-side (gate rule), approves low
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, auditLog, emails, quotes, sampleOrders, submittalPackages } from "@/db/schema";
import { resolveApprovalCore } from "@/lib/approvals/resolve";
import { REP } from "@/lib/rep";
import { sid } from "@/db/seed/ids";

const ID = {
  email: sid("apfix:email"),
  quote: sid("apfix:quote"),
  so: sid("apfix:so"),
  sample1: sid("apfix:sample1"),
  sample2: sid("apfix:sample2"),
  submittal: sid("apfix:submittal"),
  scene: sid("apfix:scene"),
  expired: sid("apfix:expired"),
};

async function status(id: string) {
  const row = await db.query.approvals.findFirst({ where: eq(approvals.id, id) });
  return row?.status;
}
async function auditCount(action: string, objectId: string) {
  const rows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.action, action), eq(auditLog.objectId, objectId)));
  return rows.length;
}

beforeAll(() => {
  // Deterministic fixtures for this suite; truncate+reseed is idempotent.
  execSync("pnpm seed --with-approvals", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("approval resolution core", () => {
  it("rejecting never executes and writes only a rejected audit row", async () => {
    const before = await db.$count(submittalPackages);
    const r = await resolveApprovalCore({ id: ID.submittal, resolution: "reject" }, REP.id);
    expect(r.outcome).toBe("rejected");
    expect(await status(ID.submittal)).toBe("rejected");
    expect(await db.$count(submittalPackages)).toBe(before); // nothing created
    expect(await auditCount("approval.rejected", ID.submittal)).toBe(1);
    expect(await auditCount("effect.executed", ID.submittal)).toBe(0);
  });

  it("expired approvals never execute", async () => {
    const before = await db.$count(emails);
    const r = await resolveApprovalCore({ id: ID.expired, resolution: "approve" }, REP.id);
    expect(r.outcome).toBe("expired");
    expect(await status(ID.expired)).toBe("expired");
    expect(await db.$count(emails)).toBe(before); // no send
  });

  it("re-runs the gate at execution time and blocks a non-allowlisted recipient", async () => {
    const before = await db.$count(emails);
    const r = await resolveApprovalCore(
      { id: ID.scene, resolution: "edit_approve", edited: { to: ["nobody@not-allowlisted.example.net"], sceneId: "x", note: "n" } },
      REP.id,
    );
    expect(r.outcome).toBe("blocked");
    if (r.outcome === "blocked") expect(r.rule).toBe("recipient_allowlist");
    expect(await status(ID.scene)).toBe("pending"); // stays actionable
    const row = await db.query.approvals.findFirst({ where: eq(approvals.id, ID.scene) });
    expect(row?.blockedReason?.rule).toBe("recipient_allowlist");
    expect(await auditCount("policy.blocked", ID.scene)).toBe(1);
    expect(await db.$count(emails)).toBe(before); // nothing executed
  });

  it("editing then approving records the diff and marks edited_approved", async () => {
    const before = await db.$count(quotes);
    const original = await db.query.approvals.findFirst({ where: eq(approvals.id, ID.quote) });
    const edited = structuredClone(original!.proposedAction) as { lines: { qty: number }[] };
    edited.lines[0]!.qty = edited.lines[0]!.qty + 7;
    const r = await resolveApprovalCore({ id: ID.quote, resolution: "edit_approve", edited }, REP.id);
    expect(r.outcome).toBe("approved");
    if (r.outcome === "approved") expect(r.status).toBe("edited_approved");
    const row = await db.query.approvals.findFirst({ where: eq(approvals.id, ID.quote) });
    expect(row?.status).toBe("edited_approved");
    expect(row?.edits?.some((e) => e.path === "lines[0].qty")).toBe(true);
    expect(await db.$count(quotes)).toBe(before + 1); // quote persisted
  });

  it("approving executes once through the provider with the right audit rows", async () => {
    const before = await db.$count(emails);
    const r = await resolveApprovalCore({ id: ID.email, resolution: "approve" }, REP.id);
    expect(r.outcome).toBe("approved");
    if (r.outcome === "approved") expect(r.status).toBe("approved");
    expect(await status(ID.email)).toBe("approved");
    expect(await db.$count(emails)).toBe(before + 1); // outbound appended to thread
    expect(await auditCount("approval.approved", ID.email)).toBe(1);
    expect(await auditCount("effect.executed", ID.email)).toBe(1);
  });

  it("batch approve refuses a non-low tier server-side", async () => {
    const r = await resolveApprovalCore({ id: ID.so, resolution: "approve", batch: true }, REP.id);
    expect(r.outcome).toBe("blocked");
    if (r.outcome === "blocked") expect(r.rule).toBe("risk_tier_batch");
    expect(await status(ID.so)).toBe("pending");
  });

  it("batch approve resolves low-tier items", async () => {
    const before = await db.$count(sampleOrders);
    const a = await resolveApprovalCore({ id: ID.sample1, resolution: "approve", batch: true }, REP.id);
    const b = await resolveApprovalCore({ id: ID.sample2, resolution: "approve", batch: true }, REP.id);
    expect(a.outcome).toBe("approved");
    expect(b.outcome).toBe("approved");
    expect(await db.$count(sampleOrders)).toBe(before + 2);
  });
});
