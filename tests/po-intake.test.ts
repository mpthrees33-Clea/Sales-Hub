/**
 * WO-06 acceptance: the clean seeded PO converts 7/7 into a draft SO with
 * page-anchored evidence; the mismatch PO stops at layer 3 with
 * expected-vs-found detail; layers are deterministic (byte-identical on
 * re-run); duplicate re-submission escalates at layer 7; escalation
 * resolution (edit → re-run) reaches 7/7; the agent has an empty allowlist.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, purchaseOrders, salesOrders } from "@/db/schema";
import { agents } from "@/agents";
import { poIntake, reparseExtraction, validateExtraction, finalizePo } from "@/app/api/workflows/po-intake/workflow";
import { runLayers } from "@/lib/po-intake/layers";
import type { PoExtraction } from "@/agents/po-intake";
import { getBlobBuffer } from "@/lib/blob";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { DEMO_NOW, PO_CLEAN_NUMBER, PO_MISMATCH_NUMBER } from "@/db/seed/scenario";

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  // Clean any prior PO pipeline residue.
  await db.execute(sql`delete from approvals where proposed_action ? 'poId'`);
  await db.execute(sql`update sales_orders set po_id = null where po_id is not null`);
  await db.execute(sql`delete from sales_orders where number >= 'SO-2050'`);
  await db.execute(sql`delete from purchase_orders`);
});

describe("po-intake agent shape", () => {
  it("has an EMPTY tool allowlist (trifecta: reads untrusted PDFs, gets nothing else)", () => {
    expect(agents["po-intake"]!.tools).toHaveLength(0);
  });
});

describe("clean PO — the <60s happy path", () => {
  it("converts 7/7 into a draft SO with a high-tier approval and page-anchored evidence", async () => {
    const result = await poIntake(`/api/blob/po/${PO_CLEAN_NUMBER}.pdf`, undefined, { trigger: "user" });
    expect(result.status).toBe("converted");
    expect(result.validation).toHaveLength(7);
    expect(result.validation.every((v) => v.pass)).toBe(true);
    expect(result.elapsedMs).toBeLessThan(60_000);

    const po = (await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, result.poId) }))!;
    expect(po.status).toBe("converted");
    expect(po.customerPoNumber).toBe(PO_CLEAN_NUMBER);

    const so = await db.query.salesOrders.findFirst({ where: eq(salesOrders.poId, result.poId) });
    expect(so).toBeTruthy();
    expect(so!.status).toBe("draft");
    expect(so!.lines).toHaveLength(3);
    expect(so!.totalCents).toBe((po.extracted as { totals: { total_cents: number } }).totals.total_cents);

    const approval = (await db.query.approvals.findFirst({ where: eq(approvals.id, result.approvalId!) }))!;
    expect(approval.kind).toBe("sales_order");
    expect(approval.riskTier).toBe("high");
    const pdfEvidence = approval.evidence.filter((e) => e.type === "pdf_page");
    // Header fields + every line + totals are page-anchored.
    expect(pdfEvidence.length).toBeGreaterThanOrEqual(4 + 3 + 1);
    expect(pdfEvidence.some((e) => (e.ref as { bbox?: unknown }).bbox)).toBe(true);
    const priceEvidence = approval.evidence.filter((e) => e.type === "price_row");
    expect(priceEvidence).toHaveLength(3);
  });

  it("re-submitting the same document escalates at layer 7 (duplicate detection) linking the prior PO", async () => {
    const result = await poIntake(`/api/blob/po/${PO_CLEAN_NUMBER}.pdf`, undefined, { trigger: "user" });
    expect(result.status).toBe("escalated");
    const l7 = result.validation.find((v) => v.layer === 7)!;
    expect(l7.pass).toBe(false);
    const dupes = (l7.detail as { duplicates: { poId: string }[] }).duplicates;
    expect(dupes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("mismatch PO — layer-3 escalation + human resolution", () => {
  it("stops amber at price_match with expected-vs-found detail; layers 1-2 and 4-7 all recorded", async () => {
    const result = await poIntake(`/api/blob/po/${PO_MISMATCH_NUMBER}.pdf`, undefined, { trigger: "user" });
    expect(result.status).toBe("escalated");
    expect(result.validation).toHaveLength(7);
    const byLayer = new Map(result.validation.map((v) => [v.layer, v]));
    expect(byLayer.get(1)!.pass).toBe(true);
    expect(byLayer.get(2)!.pass).toBe(true);
    expect(byLayer.get(3)!.pass).toBe(false);
    expect(byLayer.get(4)!.pass).toBe(true);
    expect(byLayer.get(5)!.pass).toBe(true);
    expect(byLayer.get(6)!.pass).toBe(true);
    expect(byLayer.get(7)!.pass).toBe(true);
    const mismatches = (byLayer.get(3)!.detail as { mismatches: { sku: string; expected_cents: number; found_cents: number; price_list_item_id: string }[] }).mismatches;
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]!.expected_cents - mismatches[0]!.found_cents).toBe(4000); // the seeded −$40 stale price
    expect(mismatches[0]!.price_list_item_id).toBeTruthy();

    // Escalated approval names the failing layer.
    const approval = (await db.query.approvals.findFirst({ where: eq(approvals.id, result.approvalId!) }))!;
    const blocking = (approval.proposedAction as { blocking_layers: { name: string }[] }).blocking_layers;
    expect(blocking.map((b) => b.name)).toContain("price_match");
  });

  it("edit-and-revalidate: correcting the price reaches 7/7, creates the draft SO, and records the human diff", async () => {
    const po = (await db.query.purchaseOrders.findFirst({
      where: and(eq(purchaseOrders.customerPoNumber, PO_MISMATCH_NUMBER), eq(purchaseOrders.status, "escalated")),
    }))!;
    const extracted = JSON.parse(JSON.stringify(po.extracted)) as PoExtraction & {
      lines: { unit_price_cents: number; line_total_cents?: number; qty: number }[];
      __meta?: unknown;
    };
    const l3 = po.validation!.find((v) => v.layer === 3)!;
    const mismatch = (l3.detail as { mismatches: { found_cents: number; expected_cents: number }[] }).mismatches[0]!;
    for (const line of extracted.lines) {
      if (line.unit_price_cents === mismatch.found_cents) {
        line.unit_price_cents = mismatch.expected_cents;
        if (line.line_total_cents != null) line.line_total_cents = line.qty * mismatch.expected_cents;
      }
    }
    extracted.totals.subtotal_cents = extracted.lines.reduce((a, l) => a + l.qty * l.unit_price_cents, 0);
    extracted.totals.total_cents = extracted.totals.subtotal_cents;

    const extraction = reparseExtraction(extracted as unknown as Record<string, unknown>);
    const outcome = await validateExtraction(po.id, extraction, null);
    expect(outcome.results.every((r) => r.pass)).toBe(true);
    const pending = await db.query.approvals.findFirst({
      where: and(eq(approvals.status, "pending"), sql`${approvals.proposedAction} ->> 'poId' = ${po.id}`),
    });
    const final = await finalizePo({
      poId: po.id,
      runId: null,
      t0: Date.now(),
      extraction,
      resolvedLines: outcome.resolvedLines,
      accountId: outcome.accountId,
      results: outcome.results,
      blobUrl: po.blobUrl,
      existingApprovalId: pending?.id,
    });
    expect(final.status).toBe("converted");
    const so = await db.query.salesOrders.findFirst({ where: eq(salesOrders.poId, po.id) });
    expect(so).toBeTruthy();
    expect(so!.lines.length).toBe(5);
  });
});

describe("layer determinism", () => {
  it("same input ⇒ byte-identical validation output", async () => {
    const extraction = JSON.parse(
      (await getBlobBuffer(`/api/blob/fixtures/po-extract-${PO_CLEAN_NUMBER}.json`)).toString("utf8"),
    ) as PoExtraction;
    const { loadInputForTest } = await import("./helpers/po-layer-input");
    const input = await loadInputForTest(extraction);
    const a = runLayers(JSON.parse(JSON.stringify(input)));
    const b = runLayers(JSON.parse(JSON.stringify(input)));
    expect(JSON.stringify(a.results)).toBe(JSON.stringify(b.results));
    expect(a.accountId).toBe(b.accountId);
  });
});
