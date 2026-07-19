/**
 * Policy-gate rule families (WO-01 acceptance): recipient allowlist, rate
 * caps, attachment origin, risk-tier batch rules. Runs against the seeded DB.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { db } from "@/db/client";
import { approvals, auditLog, contacts } from "@/db/schema";
import {
  assignRiskTier,
  invalidateAllowlistCache,
  POLICY_CONFIG,
  runPolicyGate,
} from "@/harness/policy-gate";
import { asc, sql } from "drizzle-orm";

const DEMO_NOW = new Date("2026-03-10T10:55:00Z");

function mkApproval(overrides: Partial<typeof approvals.$inferSelect>): typeof approvals.$inferSelect {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    runId: null,
    kind: "email_draft",
    riskTier: "standard",
    proposedAction: {},
    evidence: [],
    status: "pending",
    approverUserId: null,
    edits: null,
    blockedReason: null,
    createdDemoAt: DEMO_NOW,
    expiresDemoAt: new Date(DEMO_NOW.getTime() + 72 * 3600_000),
    resolvedAt: null,
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
    ...overrides,
  } as typeof approvals.$inferSelect;
}

let seededEmail = "";

beforeAll(async () => {
  const c = await db.select().from(contacts).orderBy(asc(contacts.email)).limit(1);
  if (!c[0]) throw new Error("run pnpm seed before tests");
  seededEmail = c[0].email;
  invalidateAllowlistCache();
  // Clean any rate-cap residue from prior test runs.
  await db.delete(auditLog).where(sql`action = 'effect.executed' and detail->>'test' = 'rate-cap'`);
});

describe("assignRiskTier", () => {
  it("sales orders are high; big quotes are high; samples are low; scheduling replies are low", () => {
    expect(assignRiskTier("sales_order", {})).toBe("high");
    expect(assignRiskTier("quote", { totalCents: POLICY_CONFIG.highQuoteThresholdCents })).toBe("high");
    expect(assignRiskTier("quote", { totalCents: 50_000 })).toBe("standard");
    expect(assignRiskTier("sample_order", {})).toBe("low");
    expect(assignRiskTier("email_draft", { intent: "scheduling" })).toBe("low");
    expect(assignRiskTier("email_draft", {})).toBe("standard");
  });
});

describe("runPolicyGate", () => {
  it("allows a seeded contact recipient", async () => {
    const verdict = await runPolicyGate(mkApproval({ proposedAction: { to: [seededEmail] } }), { demoNow: DEMO_NOW });
    expect(verdict.allowed).toBe(true);
  });

  it("blocks a non-allowlisted recipient with a named rule", async () => {
    const verdict = await runPolicyGate(
      mkApproval({ proposedAction: { to: ["nobody@not-allowlisted.example.net"] } }),
      { demoNow: DEMO_NOW },
    );
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.rule).toBe("recipient_allowlist");
      expect(verdict.reason).toContain("nobody@not-allowlisted.example.net");
    }
  });

  it("blocks a non-library attachment ref", async () => {
    const verdict = await runPolicyGate(
      mkApproval({
        proposedAction: { to: [seededEmail], attachmentAssetIds: ["11111111-1111-4111-8111-111111111111"] },
      }),
      { demoNow: DEMO_NOW },
    );
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.rule).toBe("attachment_origin");
  });

  it("high tier refuses batch context; low tier allows it", async () => {
    const highVerdict = await runPolicyGate(
      mkApproval({ riskTier: "high", proposedAction: { to: [seededEmail] } }),
      { demoNow: DEMO_NOW, batch: true },
    );
    expect(highVerdict.allowed).toBe(false);
    if (!highVerdict.allowed) expect(highVerdict.rule).toBe("risk_tier_batch");

    const lowVerdict = await runPolicyGate(
      mkApproval({ riskTier: "low", proposedAction: { to: [seededEmail] } }),
      { demoNow: DEMO_NOW, batch: true },
    );
    expect(lowVerdict.allowed).toBe(true);
  });

  it("rate cap blocks the 51st send in a demo-clock hour", async () => {
    const rows = Array.from({ length: POLICY_CONFIG.sendsPerHour }, (_, i) => ({
      actor: "system" as const,
      action: "effect.executed",
      detail: { test: "rate-cap", i },
      demoAt: new Date(DEMO_NOW.getTime() - 10 * 60_000),
    }));
    await db.insert(auditLog).values(rows);
    try {
      const verdict = await runPolicyGate(mkApproval({ proposedAction: { to: [seededEmail] } }), {
        demoNow: DEMO_NOW,
      });
      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) expect(verdict.rule).toBe("rate_cap_global");
    } finally {
      await db.delete(auditLog).where(sql`action = 'effect.executed' and detail->>'test' = 'rate-cap'`);
    }
  });
});
