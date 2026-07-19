/**
 * WO-08: Simulate Overnight on a fresh seed produces the docs/04 §3 structural
 * counts (14 triaged / 3 archived, 2 quotes, 2 stock replies, 2 sample
 * confirmations, 1 scheduling, 1 technical, 1 validated SO, 1 escalated PO,
 * opportunity updates incl. the Phase 3 __create__, 1 brief); a second run is a
 * no-op; the dispatch registry skips unmerged targets.
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, emailThreads, morningBriefs, purchaseOrders } from "@/db/schema";
import { nightlyRun } from "@/app/api/workflows/nightly";
import { dispatchRouting } from "@/lib/nightly-dispatch";

let first: Awaited<ReturnType<typeof nightlyRun>>;

beforeAll(async () => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
  first = await nightlyRun({ trigger: "simulate" });
}, 120_000);

describe("nightly run", () => {
  it("triages the full batch and archives the noise", () => {
    expect(first.triaged).toBe(14);
    expect(first.processed).toBe(14);
  });

  it("produces the expected approval-queue composition", async () => {
    const pending = await db.select().from(approvals).where(eq(approvals.status, "pending"));
    const byKind = pending.reduce<Record<string, number>>((m, a) => ((m[a.kind] = (m[a.kind] ?? 0) + 1), m), {});
    expect(byKind.sample_order).toBe(2);
    expect(byKind.sales_order).toBe(2); // 1 validated SO + 1 escalated PO
    expect(byKind.email_draft).toBeGreaterThanOrEqual(7); // 2 quotes + 4 replies + 2 sample confirmations + meeting follow-up
    expect((byKind.opportunity_update ?? 0)).toBeGreaterThanOrEqual(3);

    const archived = (await db.select().from(emailThreads).where(eq(emailThreads.status, "archived"))).length;
    expect(archived).toBe(3);

    const po = await db.select().from(purchaseOrders);
    expect(po.filter((p) => p.status === "converted").length).toBe(1);
    expect(po.filter((p) => p.status === "escalated").length).toBe(1);

    const phase3 = pending.filter((a) => a.kind === "opportunity_update" && (a.proposedAction as { newOpportunity?: unknown }).newOpportunity);
    expect(phase3.length).toBeGreaterThanOrEqual(1);

    const brief = await db.query.morningBriefs.findFirst({ where: eq(morningBriefs.id, first.briefId!) });
    expect(brief?.narrative).toContain("triaged 14");
    expect((brief!.brief as { counts?: { archived?: number } }).counts?.archived).toBe(3);
  });

  it("is idempotent — a second simulate is a no-op", async () => {
    const again = await nightlyRun({ trigger: "simulate" });
    expect(again.note).toBe("nothing to process");
    expect(again.processed).toBe(0);
  });

  it("dispatch skips an unmerged target (submittal) instead of failing", async () => {
    const r = await dispatchRouting({ id: "x", emailId: "e", threadId: "t", category: "submittal_request", confidence: "0.9", target: "submittal", status: "pending", consumedByRunId: null, payload: null, createdAt: new Date(), updatedAt: new Date() } as never);
    expect(r.status).toBe("skipped");
    expect(r.detail).toBe("module_not_installed");
  });
});
