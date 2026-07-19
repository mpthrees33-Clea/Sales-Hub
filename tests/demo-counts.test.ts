/**
 * WO-13 task 5 + 10 (automated): the docs/04 §3 overnight contract, asserted
 * TWICE — reset day → Simulate Overnight must produce the exact queue, and a
 * second full take must be identical. Fails on any count drift.
 * Run alone via `pnpm test:demo`.
 */
import { describe, expect, it } from "vitest";
import "@/lib/load-env";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, morningBriefs, purchaseOrders, submittalPackages } from "@/db/schema";
import { nightlyRun } from "@/app/api/workflows/nightly";
import { runSeed } from "@/db/seed";

type TakeSnapshot = {
  counts: Record<string, number>;
  queue: { kind: string; tier: string; n: number }[];
  quoteDrafts: number;
  poStatuses: string[];
  briefs: number;
  preparedSubmittals: { products: number; status: string }[];
};

async function fullTake(): Promise<TakeSnapshot> {
  const seeded = await runSeed({ resetDay: true });
  expect(seeded.ok).toBe(true);

  const result = await nightlyRun({ trigger: "simulate" });
  expect(result.status).toBe("completed");
  if (result.status !== "completed") throw new Error("unreachable");
  expect(result.skipped).toEqual([]);

  const queue = await db
    .select({ kind: approvals.kind, tier: approvals.riskTier, n: count() })
    .from(approvals)
    .where(eq(approvals.status, "pending"))
    .groupBy(approvals.kind, approvals.riskTier)
    .orderBy(asc(approvals.kind), asc(approvals.riskTier));

  const [quoteDrafts] = await db
    .select({ n: count() })
    .from(approvals)
    .where(sql`${approvals.status} = 'pending' and ${approvals.proposedAction} ->> 'quoteNumber' is not null`);

  const pos = await db.select({ status: purchaseOrders.status }).from(purchaseOrders);
  const [briefs] = await db.select({ n: count() }).from(morningBriefs);
  const prepared = await db.query.submittalPackages.findMany({ where: eq(submittalPackages.status, "draft") });

  return {
    counts: result.counts as unknown as Record<string, number>,
    queue: queue.map((q) => ({ kind: q.kind, tier: q.tier, n: q.n })),
    quoteDrafts: quoteDrafts!.n,
    poStatuses: pos.map((p) => p.status).sort(),
    briefs: briefs!.n,
    preparedSubmittals: prepared.map((p) => ({ products: p.productIds.length, status: p.status })),
  };
}

function assertContract(take: TakeSnapshot) {
  // docs/04 §3, verbatim: 14 triaged (3 noise archived) · 9 drafts (2 quote
  // drafts HIGH · 2 stock + 1 technical + 1 meeting follow-up STANDARD ·
  // 1 scheduling + 2 sample confirmations LOW) · 1 validated PO → draft SO ·
  // 1 escalated PO (layer 3) · 3 opportunity updates · 2 sample orders ·
  // 1 morning brief · 1 prepared submittal builder session.
  expect(take.counts.triaged).toBe(14);
  expect(take.counts.archived).toBe(3);
  expect(take.counts.drafts).toBe(9);
  expect(take.counts.validatedPo).toBe(1);
  expect(take.counts.escalatedPo).toBe(1);
  expect(take.counts.opportunityUpdates).toBe(3);
  expect(take.counts.samples).toBe(2);
  expect(take.counts.approvalsPending).toBe(16);

  expect(take.queue).toEqual([
    { kind: "email_draft", tier: "low", n: 3 },
    { kind: "email_draft", tier: "standard", n: 4 },
    { kind: "email_draft", tier: "high", n: 2 },
    { kind: "sales_order", tier: "high", n: 2 },
    { kind: "sample_order", tier: "low", n: 2 },
    { kind: "opportunity_update", tier: "standard", n: 3 },
  ]);
  expect(take.quoteDrafts).toBe(2); // the two HIGH drafts carry quote numbers
  expect(take.poStatuses).toEqual(["converted", "escalated"]);
  expect(take.briefs).toBe(1);
  expect(take.preparedSubmittals).toEqual([{ products: 3, status: "draft" }]);
}

describe("the two-takes proof (docs/04 §3 counts, twice in a row)", () => {
  it("take 1: reset day → simulate overnight → exact contract", { timeout: 120_000 }, async () => {
    assertContract(await fullTake());
  });

  it("take 2: identical queue, no residue from take 1", { timeout: 120_000 }, async () => {
    const take2 = await fullTake();
    assertContract(take2);
  });
});
