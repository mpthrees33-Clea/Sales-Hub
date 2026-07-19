/**
 * WO-06 acceptance: the clean seeded PO validates 7/7 into a draft SO + high-tier
 * approval in < 60s with page-anchored evidence; the mismatch PO stops at layer 3
 * (price_match) with expected-vs-found and still records all seven; layers are
 * byte-identical across runs; a non-PO PDF escalates at extraction with no SO;
 * re-submitting the clean PO escalates at layer 7 (duplicate).
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, salesOrders } from "@/db/schema";
import { startPoIntake } from "@/app/api/workflows/po-intake/start";
import { runAllLayers } from "@/lib/po-intake/layers";
import { getBlobBuffer } from "@/lib/blob";
import { poExtraction } from "@/agents/po-intake";

const CLEAN = "/api/blob/po/PO-88231.pdf";
const MISMATCH = "/api/blob/po/PO-55107.pdf";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("PO Intake pipeline", () => {
  it("validates the clean PO 7/7 into a draft SO + high-tier approval, < 60s", async () => {
    const soBefore = await db.$count(salesOrders);
    const r = await startPoIntake({ blobUrl: CLEAN });
    expect(r.status).toBe("converted");
    expect(r.passed).toBe(7);
    expect(r.elapsedMs).toBeLessThan(60_000);
    expect(await db.$count(salesOrders)).toBe(soBefore + 1);

    const appr = await db.query.approvals.findFirst({ where: eq(approvals.id, r.approvalId!) });
    expect(appr?.kind).toBe("sales_order");
    expect(appr?.riskTier).toBe("high");
    const types = new Set(appr!.evidence.map((e) => e.type));
    expect(types.has("pdf_page")).toBe(true);
    expect(types.has("price_row")).toBe(true);
  });

  it("escalates the mismatch PO at layer 3 with expected-vs-found; all seven recorded", async () => {
    const soBefore = await db.$count(salesOrders);
    const r = await startPoIntake({ blobUrl: MISMATCH });
    expect(r.status).toBe("escalated");
    expect(await db.$count(salesOrders)).toBe(soBefore); // no SO on escalation

    const po = await db.query.purchaseOrders.findFirst({ where: (p, { eq: e }) => e(p.id, r.poId) });
    const validation = po!.validation!;
    expect(validation).toHaveLength(7);
    const l3 = validation.find((v) => v.layer === 3)!;
    expect(l3.pass).toBe(false);
    const mismatches = (l3.detail as { mismatches?: { expected_cents: number; found_cents: number }[] }).mismatches!;
    expect(mismatches[0]!.expected_cents).not.toBe(mismatches[0]!.found_cents);

    const appr = await db.query.approvals.findFirst({ where: eq(approvals.id, r.approvalId!) });
    expect((appr!.proposedAction as { blocking_layers?: unknown[] }).blocking_layers?.length).toBeGreaterThanOrEqual(1);
  });

  it("layers are byte-identical across runs (pure/deterministic)", async () => {
    const raw = JSON.parse((await getBlobBuffer("/api/blob/fixtures/po-extract-PO-88231.json")).toString("utf8"));
    const ex1 = poExtraction.parse(structuredClone(raw));
    const ex2 = poExtraction.parse(structuredClone(raw));
    const v1 = await runAllLayers({ extraction: ex1, poId: "00000000-0000-4000-8000-000000000001", demoNow: new Date("2026-03-10T10:55:00Z"), pageCount: 1 });
    const v2 = await runAllLayers({ extraction: ex2, poId: "00000000-0000-4000-8000-000000000001", demoNow: new Date("2026-03-10T10:55:00Z"), pageCount: 1 });
    expect(JSON.stringify(v1)).toBe(JSON.stringify(v2));
    expect(v1).toHaveLength(7);
  });

  it("escalates a non-PO PDF at extraction (schema/manifest) with no SO", async () => {
    const soBefore = await db.$count(salesOrders);
    const r = await startPoIntake({ blobUrl: "/api/blob/docs/MS-WG-1147-pds.pdf" });
    expect(r.status).toBe("escalated");
    expect(await db.$count(salesOrders)).toBe(soBefore);
  });

  it("detects a duplicate on re-submitting the clean PO (layer 7)", async () => {
    const r = await startPoIntake({ blobUrl: CLEAN });
    expect(r.status).toBe("escalated");
    const po = await db.query.purchaseOrders.findFirst({ where: (p, { eq: e }) => e(p.id, r.poId) });
    const l7 = po!.validation!.find((v) => v.layer === 7)!;
    expect(l7.pass).toBe(false);
    expect((l7.detail as { prior_po_id?: string }).prior_po_id).toBeTruthy();
  });
});
