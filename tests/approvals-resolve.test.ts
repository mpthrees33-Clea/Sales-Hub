/**
 * WO-03 acceptance for the resolution core (`resolveApprovalCore`) — the ONLY
 * executor. Because the core is context-free (it takes a userId rather than
 * reading the session cookie), these drive the WHOLE state machine end to end
 * — something the server-action-bound suite couldn't do. Effects go through
 * A's kind→effect map (src/lib/approvals/execute.ts).
 *
 *  - rejecting never calls the gate or a provider (no side effects)
 *  - expired approvals never execute
 *  - the policy gate re-runs at execution time; a block leaves status pending +
 *    writes policy.blocked; nothing executes
 *  - editing then approving records the diff and sets edited_approved
 *  - approving executes exactly once with approval.approved + effect.executed
 *  - batch approve refuses non-low tiers server-side; approves low tiers
 *  - a provider/DB failure rolls the claim back to pending + audits effect.failed
 *    (compensating rollback — never a partial execute)
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, auditLog, contacts, emails, opportunities, sampleOrders } from "@/db/schema";
import { resolveApprovalCore } from "@/lib/approvals/resolve";
import { createApprovalRow } from "@/harness/approvals";
import { REP } from "@/lib/rep";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { DEMO_NOW } from "@/db/seed/scenario";

let contactEmail = "";
let accountId = "";
let contactId = "";

async function statusOf(id: string): Promise<string | undefined> {
  const row = await db.query.approvals.findFirst({ where: eq(approvals.id, id) });
  return row?.status;
}
async function auditCount(action: string, objectId: string): Promise<number> {
  const rows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.action, action), eq(auditLog.objectId, objectId)));
  return rows.length;
}

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  const [c] = await db.select().from(contacts).orderBy(asc(contacts.email)).limit(1);
  contactEmail = c!.email;
  accountId = c!.accountId;
  contactId = c!.id;
});

async function mkEmail(to: string[], extra: Record<string, unknown> = {}) {
  const { approvalId } = await createApprovalRow({
    runId: null,
    agentName: "test",
    kind: "email_draft",
    proposedAction: { to, subject: "Provider probe", bodyText: "Hello.\n\n—Cole", ...extra },
    evidence: [],
    demoNow: DEMO_NOW,
  });
  return approvalId;
}

describe("resolveApprovalCore", () => {
  it("approving an email_draft executes once with approval.approved + effect.executed", async () => {
    const id = await mkEmail([contactEmail]);
    const before = await db.$count(emails);
    const r = await resolveApprovalCore({ id, resolution: "approve" }, REP.id);
    expect(r.outcome).toBe("approved");
    expect(await statusOf(id)).toBe("approved");
    expect(await db.$count(emails)).toBe(before + 1);
    expect(await auditCount("approval.approved", id)).toBe(1);
    expect(await auditCount("effect.executed", id)).toBe(1);
  });

  it("rejecting never executes and writes only a rejected audit row", async () => {
    const id = await mkEmail([contactEmail]);
    const before = await db.$count(emails);
    const r = await resolveApprovalCore({ id, resolution: "reject" }, REP.id);
    expect(r.outcome).toBe("rejected");
    expect(await statusOf(id)).toBe("rejected");
    expect(await db.$count(emails)).toBe(before);
    expect(await auditCount("approval.rejected", id)).toBe(1);
    expect(await auditCount("effect.executed", id)).toBe(0);
  });

  it("expired approvals never execute", async () => {
    const past = new Date(DEMO_NOW.getTime() - 100 * 3600_000);
    const [row] = await db
      .insert(approvals)
      .values({
        kind: "email_draft",
        riskTier: "standard",
        proposedAction: { to: [contactEmail], subject: "stale", bodyText: "x" },
        evidence: [],
        status: "pending",
        createdDemoAt: past,
        expiresDemoAt: new Date(past.getTime() + 72 * 3600_000),
      })
      .returning({ id: approvals.id });
    const before = await db.$count(emails);
    const r = await resolveApprovalCore({ id: row!.id, resolution: "approve" }, REP.id);
    expect(r.outcome).toBe("expired");
    expect(await statusOf(row!.id)).toBe("expired");
    expect(await db.$count(emails)).toBe(before);
  });

  it("editing then approving records the diff and marks edited_approved", async () => {
    const id = await mkEmail([contactEmail]);
    const original = await db.query.approvals.findFirst({ where: eq(approvals.id, id) });
    const edited = { ...(original!.proposedAction as Record<string, unknown>), subject: "Provider probe (edited)" };
    const before = await db.$count(emails);
    const r = await resolveApprovalCore({ id, resolution: "edit_approve", edited }, REP.id);
    expect(r.outcome).toBe("approved");
    const row = await db.query.approvals.findFirst({ where: eq(approvals.id, id) });
    expect(row?.status).toBe("edited_approved");
    expect(row?.edits?.some((e) => e.path === "subject")).toBe(true);
    expect(await db.$count(emails)).toBe(before + 1);
  });

  it("re-runs the gate at execution time and blocks a non-allowlisted recipient", async () => {
    const id = await mkEmail(["nobody@not-allowlisted.example.net"]);
    const before = await db.$count(emails);
    const r = await resolveApprovalCore({ id, resolution: "approve" }, REP.id);
    expect(r.outcome).toBe("blocked");
    if (r.outcome === "blocked") expect(r.rule).toBe("recipient_allowlist");
    expect(await statusOf(id)).toBe("pending");
    const row = await db.query.approvals.findFirst({ where: eq(approvals.id, id) });
    expect(row?.blockedReason?.rule).toBe("recipient_allowlist");
    expect(await auditCount("policy.blocked", id)).toBe(1);
    expect(await db.$count(emails)).toBe(before);
  });

  it("batch approve refuses a non-low tier server-side", async () => {
    const { approvalId } = await createApprovalRow({
      runId: null,
      agentName: "test",
      kind: "sales_order",
      proposedAction: { accountId, lines: [], subtotalCents: 500, totalCents: 500 },
      evidence: [],
      demoNow: DEMO_NOW,
    });
    const r = await resolveApprovalCore({ id: approvalId, resolution: "approve", batch: true }, REP.id);
    expect(r.outcome).toBe("blocked");
    if (r.outcome === "blocked") expect(r.rule).toBe("risk_tier_batch");
    expect(await statusOf(approvalId)).toBe("pending");
  });

  it("batch approve resolves a low-tier sample order", async () => {
    const { approvalId } = await createApprovalRow({
      runId: null,
      agentName: "test",
      kind: "sample_order",
      proposedAction: {
        accountId,
        contactId,
        items: [{ productId: null, size: "8x10", qty: 1 }],
        shipTo: { line1: "1 Main", city: "Charlotte", state: "NC", zip: "28202" },
      },
      evidence: [],
      demoNow: DEMO_NOW,
    });
    const before = await db.$count(sampleOrders);
    const r = await resolveApprovalCore({ id: approvalId, resolution: "approve", batch: true }, REP.id);
    expect(r.outcome).toBe("approved");
    expect(await db.$count(sampleOrders)).toBe(before + 1);
  });

  it("rolls a provider/DB failure back to pending and audits effect.failed", async () => {
    // opportunity_update with a non-existent account → the executor's INSERT
    // throws (FK violation). The core must revert the claim, not partial-execute.
    const { approvalId } = await createApprovalRow({
      runId: null,
      agentName: "test",
      kind: "opportunity_update",
      proposedAction: {
        accountId: "00000000-0000-4000-8000-0000000000ff",
        newOpportunity: { name: "Rollback probe", stage: "lead", valueCents: 1000 },
        fieldDiffs: [],
      },
      evidence: [],
      demoNow: DEMO_NOW,
    });
    const oppBefore = await db.$count(opportunities);
    const r = await resolveApprovalCore({ id: approvalId, resolution: "approve" }, REP.id);
    expect(r.outcome).toBe("error");
    expect(await statusOf(approvalId)).toBe("pending"); // reverted
    expect(await db.$count(opportunities)).toBe(oppBefore); // nothing created
    expect(await auditCount("effect.failed", approvalId)).toBe(1);
    expect(await auditCount("approval.approved", approvalId)).toBe(0);
    expect(await auditCount("effect.executed", approvalId)).toBe(0);
  });
});
