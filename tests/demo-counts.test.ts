/**
 * WO-13 task 5 — determinism lock. Simulate Overnight on a fresh seed must
 * produce the exact structural queue every take (docs/04 §3). Prose may vary
 * with the model; these COUNTS may not. Any drift fails here before it reaches
 * a filming take.
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, emailThreads, morningBriefs, purchaseOrders } from "@/db/schema";
import { nightlyRun } from "@/app/api/workflows/nightly";

let byKind: Record<string, number>;
let archived: number;
let briefs: number;
let po: { status: string }[];
let phase3: number;

beforeAll(async () => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
  const run = await nightlyRun({ trigger: "simulate" });
  expect(run.triaged).toBe(14);
  expect(run.processed).toBe(14);

  const pending = await db.select().from(approvals).where(eq(approvals.status, "pending"));
  byKind = pending.reduce<Record<string, number>>((m, a) => ((m[a.kind] = (m[a.kind] ?? 0) + 1), m), {});
  archived = (await db.select().from(emailThreads).where(eq(emailThreads.status, "archived"))).length;
  briefs = (await db.select().from(morningBriefs)).length;
  po = await db.select({ status: purchaseOrders.status }).from(purchaseOrders);
  phase3 = pending.filter((a) => a.kind === "opportunity_update" && (a.proposedAction as { newOpportunity?: unknown }).newOpportunity).length;
}, 120_000);

describe("Simulate Overnight — deterministic queue composition (docs/04 §3)", () => {
  it("triages 14 and archives the 3 noise threads", () => {
    expect(archived).toBe(3);
  });

  it("produces exactly the expected approval kinds", () => {
    expect(byKind.sample_order).toBe(2); // 2 sample confirmations' orders
    expect(byKind.sales_order).toBe(2); // 1 validated draft SO + 1 escalated PO's SO
    expect(byKind.email_draft).toBe(9); // 2 quotes + 2 stock + 1 scheduling + 1 technical + 2 sample confirmations + 1 meeting follow-up
    expect(byKind.opportunity_update).toBe(4); // incl. the Phase 3 proposal
    expect(byKind.quote ?? 0).toBe(0); // quotes are drafted as email_draft, not standalone
  });

  it("escalates exactly one PO and converts exactly one", () => {
    expect(po.filter((p) => p.status === "escalated").length).toBe(1);
    expect(po.filter((p) => p.status === "converted").length).toBe(1);
  });

  it("proposes the Phase 3 opportunity and writes one morning brief", () => {
    expect(phase3).toBeGreaterThanOrEqual(1);
    expect(briefs).toBe(1);
  });
});
