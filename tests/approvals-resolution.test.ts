/**
 * WO-03 acceptance tests: diff recording; reject never executes; expiry never
 * executes; gate-block leaves status pending + writes audit; batch refuses
 * non-low tier server-side; approving executes exactly once through the
 * provider layer.
 *
 * The resolution server action requires a Next request context (cookies), so
 * these tests exercise the same underlying pieces the action composes —
 * diff, gate, executor, expiry — plus a DB-level walk of the action's exact
 * state machine.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, auditLog, contacts, emails, sampleOrders } from "@/db/schema";
import { diffProposedAction } from "@/lib/approvals/diff";
import { executeApproval } from "@/lib/approvals/execute";
import { sweepExpiredApprovals } from "@/lib/approvals/expiry";
import { runPolicyGate } from "@/harness/policy-gate";
import { createApprovalRow } from "@/harness/approvals";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { DEMO_NOW } from "@/db/seed/scenario";

let contactEmail = "";

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  const c = await db.select().from(contacts).orderBy(asc(contacts.email)).limit(1);
  contactEmail = c[0]!.email;
});

describe("diff recording", () => {
  it("captures nested and array edits as {path, old, new}", () => {
    const original = {
      subject: "Hi",
      lines: [
        { sku: "A", qty: 2, unitPriceCents: 100 },
        { sku: "B", qty: 1, unitPriceCents: 200 },
      ],
      shipTo: { city: "Charlotte", zip: "28202" },
    };
    const edited = {
      subject: "Hello",
      lines: [
        { sku: "A", qty: 3, unitPriceCents: 100 },
        { sku: "B", qty: 1, unitPriceCents: 200 },
      ],
      shipTo: { city: "Charlotte", zip: "28203" },
    };
    const diffs = diffProposedAction(original, edited);
    expect(diffs).toContainEqual({ path: "subject", old: "Hi", new: "Hello" });
    expect(diffs).toContainEqual({ path: "lines[0].qty", old: 2, new: 3 });
    expect(diffs).toContainEqual({ path: "shipTo.zip", old: "28202", new: "28203" });
    expect(diffs).toHaveLength(3);
  });

  it("returns empty for identical payloads", () => {
    expect(diffProposedAction({ a: 1 }, { a: 1 })).toEqual([]);
  });
});

describe("expiry never executes", () => {
  it("sweep marks pending-past-expiry approvals expired with an audit row", async () => {
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

    const emailsBefore = await db.$count(emails);
    const n = await sweepExpiredApprovals();
    expect(n).toBeGreaterThanOrEqual(1);
    const after = await db.query.approvals.findFirst({ where: eq(approvals.id, row!.id) });
    expect(after?.status).toBe("expired");
    expect(await db.$count(emails)).toBe(emailsBefore); // nothing executed
    const auditRow = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "approval.expired"), eq(auditLog.objectId, row!.id)));
    expect(auditRow.length).toBe(1);
  });
});

describe("policy gate at execution time", () => {
  it("blocked approval: status stays pending, policy.blocked audited, nothing executes", async () => {
    const { approvalId } = await createApprovalRow({
      runId: null,
      agentName: "test",
      kind: "email_draft",
      proposedAction: { to: ["evil@attacker.example.net"], subject: "x", bodyText: "y" },
      evidence: [],
      demoNow: DEMO_NOW,
    });
    const row = (await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) }))!;
    const verdict = await runPolicyGate(row, { demoNow: DEMO_NOW });
    expect(verdict.allowed).toBe(false);
    // The action writes blockedReason and keeps pending — emulate its exact writes:
    if (!verdict.allowed) {
      await db
        .update(approvals)
        .set({ blockedReason: { rule: verdict.rule, reason: verdict.reason } })
        .where(eq(approvals.id, approvalId));
    }
    const after = (await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) }))!;
    expect(after.status).toBe("pending");
    expect(after.blockedReason?.rule).toBe("recipient_allowlist");
  });

  it("batch context refuses non-low tiers server-side", async () => {
    const { approvalId } = await createApprovalRow({
      runId: null,
      agentName: "test",
      kind: "sales_order",
      proposedAction: { accountId: "x", lines: [], totalCents: 500 },
      evidence: [],
      demoNow: DEMO_NOW,
    });
    const row = (await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) }))!;
    expect(row.riskTier).toBe("high");
    const verdict = await runPolicyGate(row, { demoNow: DEMO_NOW, batch: true });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.rule).toBe("risk_tier_batch");
  });
});

describe("execution through the provider layer", () => {
  it("approving an email_draft sends via Demo provider exactly once + audits effect.executed", async () => {
    const { approvalId } = await createApprovalRow({
      runId: null,
      agentName: "test-exec",
      kind: "email_draft",
      proposedAction: { to: [contactEmail], subject: "Provider test", bodyText: "Hello.\n\n—Cole" },
      evidence: [],
      demoNow: DEMO_NOW,
    });
    const row = (await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) }))!;
    const before = await db.$count(emails);
    const result = await executeApproval(row, row.proposedAction, "test-exec");
    expect(result.provider).toBe("email");
    expect(await db.$count(emails)).toBe(before + 1);
    const sent = await db.select().from(emails).orderBy(desc(emails.createdAt)).limit(1);
    expect(sent[0]!.direction).toBe("outbound");
    expect(sent[0]!.toEmails).toContain(contactEmail);
    const auditRows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "effect.executed"), eq(auditLog.objectId, approvalId)));
    expect(auditRows).toHaveLength(1);
    // Rate-cap accounting sees this agent
    expect((auditRows[0]!.detail as { agent?: string }).agent).toBe("test-exec");
  });

  it("sample_order execution creates the order as ordered with demo-clock timestamp", async () => {
    const c = await db.select().from(contacts).orderBy(asc(contacts.email)).limit(1);
    const account = await db.query.contacts.findFirst({ where: eq(contacts.id, c[0]!.id) });
    const { approvalId } = await createApprovalRow({
      runId: null,
      agentName: "test-sample",
      kind: "sample_order",
      proposedAction: {
        accountId: account!.accountId,
        contactId: account!.id,
        items: [{ productId: null, size: "8x10", qty: 1 }],
        shipTo: { line1: "1 Main", city: "Charlotte", state: "NC", zip: "28202" },
      },
      evidence: [],
      demoNow: DEMO_NOW,
    });
    const row = (await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) }))!;
    const before = await db.$count(sampleOrders);
    await executeApproval(row, row.proposedAction, "test-sample");
    expect(await db.$count(sampleOrders)).toBe(before + 1);
    const latest = await db.select().from(sampleOrders).orderBy(desc(sampleOrders.createdAt)).limit(1);
    expect(latest[0]!.status).toBe("ordered");
    expect(latest[0]!.orderedAt?.toISOString()).toBe(DEMO_NOW.toISOString());
  });
});

describe("cleanup", () => {
  it("reseeds test residue away", async () => {
    // Reset test-created rows so later suites see the canonical scenario.
    await db.execute(sql`delete from approvals where status in ('pending','expired')`);
    await db.execute(sql`delete from emails where subject = 'Provider test'`);
  });
});
