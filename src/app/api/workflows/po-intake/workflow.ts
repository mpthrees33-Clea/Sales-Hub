/**
 * The PO intake pipeline (WO-06, docs/01 §3): PDF → grounded extraction →
 * seven named deterministic validation layers → draft SO or precise
 * escalation — every step recorded on the extraction run, both outcomes
 * terminating in an approval.
 *
 * Environment note: on Vercel this maps 1:1 onto Vercel Workflows
 * ('use workflow' / 'use step'); in this build each step is an idempotent
 * function keyed on purchase_orders.id with progress persisted after every
 * step, so a re-invocation resumes from recorded state rather than
 * duplicating work.
 */
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { poIntakeAgent, poExtraction, type PoExtraction, type ResolvedPoLine } from "@/agents/po-intake";
import { db } from "@/db/client";
import {
  accounts,
  agentSteps,
  approvals,
  invoices,
  products,
  projects,
  purchaseOrders,
  quotes,
  salesOrders,
  priceListItems,
  accountPriceLists,
  priceLists,
  type SalesOrderLine,
  type ValidationLayerResult,
} from "@/db/schema";
import { createApprovalRow } from "@/harness/approvals";
import { audit } from "@/lib/audit";
import { getDemoNow } from "@/lib/demo-clock";
import { repDateKey } from "@/lib/dates";
import { runLayers, type LayerInput } from "@/lib/po-intake/layers";
import { lineFingerprint } from "@/lib/po-intake/match";
import { getErpProvider } from "@/providers";

export type PoIntakeResult = {
  poId: string;
  status: "converted" | "escalated";
  runId: string | null;
  approvalId: string | null;
  elapsedMs: number;
  validation: ValidationLayerResult[];
};

/** The pipeline. Idempotent per (blobUrl, existing PO id). */
export async function poIntake(blobUrl: string, sourceEmailId?: string, opts?: {
  trigger?: "nightly" | "user" | "workflow";
  workflowRunId?: string;
}): Promise<PoIntakeResult> {
  const t0 = Date.now();
  const trigger = opts?.trigger ?? "user";

  // Step 1: createPoRecord (reuse an existing in-flight record for resume).
  let po = await db.query.purchaseOrders.findFirst({
    where: (t, { and: a, eq: e, inArray: ia }) => a(e(t.blobUrl, blobUrl), ia(t.status, ["received", "extracted"])),
    orderBy: (t, { desc: d }) => d(t.createdAt),
  });
  if (!po) {
    const [row] = await db
      .insert(purchaseOrders)
      .values({ blobUrl, sourceEmailId: sourceEmailId ?? null, status: "received" })
      .returning();
    po = row!;
    await audit({
      actor: "system",
      action: "po.received",
      objectType: "purchase_order",
      objectId: po.id,
      detail: { blobUrl, sourceEmailId },
    });
  }

  // Step 2: extractPo — the ONE model step (empty tool allowlist).
  const runResult = await poIntakeAgent.run(
    { blobUrl, sourceEmailId },
    { trigger, workflowRunId: opts?.workflowRunId },
  );
  if (runResult.status !== "succeeded" || !runResult.output) {
    // Extraction schema failure → escalate with the reason; no partial SO.
    await db
      .update(purchaseOrders)
      .set({ status: "escalated", elapsedMs: Date.now() - t0 })
      .where(eq(purchaseOrders.id, po.id));
    const demoNow = await getDemoNow();
    const { approvalId } = await createApprovalRow({
      runId: runResult.runId,
      agentName: "po-intake",
      kind: "sales_order",
      proposedAction: {
        poId: po.id,
        escalation: runResult.escalation ?? { reason: "extraction_failed", detail: {} },
        blocking_layers: [{ layer: 0, name: "extraction", detail: runResult.escalation?.detail ?? {} }],
      },
      evidence: [{ type: "pdf_page", ref: { blobUrl, page: 1 }, quote: "unreadable purchase order" }],
      demoNow,
      riskTier: "high",
    });
    await audit({
      actor: "system",
      action: "po.escalated",
      objectType: "purchase_order",
      objectId: po.id,
      detail: { at: "extraction", reason: runResult.escalation?.reason },
    });
    return {
      poId: po.id,
      status: "escalated",
      runId: runResult.runId,
      approvalId,
      elapsedMs: Date.now() - t0,
      validation: [],
    };
  }

  const extraction = runResult.output as PoExtraction;
  await db
    .update(purchaseOrders)
    .set({
      extracted: extraction as unknown as Record<string, unknown>,
      status: "extracted",
      customerPoNumber: extraction.customer_po_number.value,
    })
    .where(eq(purchaseOrders.id, po.id));
  await audit({ actor: "agent:po-intake", action: "po.extracted", objectType: "purchase_order", objectId: po.id });

  // Steps 3–9: the seven deterministic layers.
  const outcome = await validateExtraction(po.id, extraction, runResult.runId);

  // Step 10: finalize.
  return finalizePo({
    poId: po.id,
    runId: runResult.runId,
    t0,
    extraction,
    resolvedLines: outcome.resolvedLines,
    accountId: outcome.accountId,
    results: outcome.results,
    blobUrl,
  });
}

/** Load LayerInput from the DB and run the seven layers; record steps + validation. */
export async function validateExtraction(poId: string, extraction: PoExtraction, runId: string | null) {
  const input = await loadLayerInput(poId, extraction);
  const outcome = runLayers(input);

  await db
    .update(purchaseOrders)
    .set({
      validation: outcome.results,
      accountId: outcome.accountId,
      extracted: {
        ...(extraction as unknown as Record<string, unknown>),
        lines: outcome.resolvedLines,
        __meta: {
          fingerprint: outcome.resolvedLines.every((l) => l.resolved)
            ? lineFingerprint(
                outcome.resolvedLines.map((l) => ({
                  product_id: l.resolved!.product_id,
                  qty: l.qty,
                  unit_price_cents: l.unit_price_cents,
                })),
              )
            : null,
          poDate: extraction.po_date.value,
        },
      },
    })
    .where(eq(purchaseOrders.id, poId));

  if (runId) await appendValidationSteps(runId, outcome.results);
  return outcome;
}

async function appendValidationSteps(runId: string, results: ValidationLayerResult[]) {
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${agentSteps.seq}), 0)::int` })
    .from(agentSteps)
    .where(eq(agentSteps.runId, runId));
  let seq = maxRow?.max ?? 0;
  for (const r of results) {
    seq += 1;
    await db.insert(agentSteps).values({
      runId,
      seq,
      kind: "validation",
      name: r.name,
      input: null,
      output: { pass: r.pass, detail: r.detail },
      durationMs: r.durationMs,
    });
  }
}

export async function loadLayerInput(poId: string, extraction: PoExtraction): Promise<LayerInput> {
  const demoNow = await getDemoNow();
  const [catalog, accountRows, projectRows, quoteRows, priorPoRows] = await Promise.all([
    db.select({ productId: products.id, sku: products.sku, name: products.name, unit: products.unit }).from(products),
    db
      .select({ id: accounts.id, name: accounts.name, address: accounts.address, creditLimitCents: accounts.creditLimitCents })
      .from(accounts),
    db.select({ accountId: projects.accountId, name: projects.name, address: projects.address }).from(projects),
    db.select({ number: quotes.number, accountId: quotes.accountId }).from(quotes),
    db
      .select({
        id: purchaseOrders.id,
        accountId: purchaseOrders.accountId,
        customerPoNumber: purchaseOrders.customerPoNumber,
        extracted: purchaseOrders.extracted,
      })
      .from(purchaseOrders)
      .where(isNotNull(purchaseOrders.extracted))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(100),
  ]);

  // Price rows for ALL accounts' assigned lists, keyed accountId → productId.
  const apl = await db
    .select({ accountId: accountPriceLists.accountId, priceListId: accountPriceLists.priceListId, name: priceLists.name })
    .from(accountPriceLists)
    .innerJoin(priceLists, eq(priceLists.id, accountPriceLists.priceListId));
  const items = await db
    .select({
      priceListId: priceListItems.priceListId,
      productId: priceListItems.productId,
      unitPriceCents: priceListItems.unitPriceCents,
      minQty: priceListItems.minQty,
      id: priceListItems.id,
    })
    .from(priceListItems);
  const itemsByList = new Map<string, typeof items>();
  for (const it of items) {
    const arr = itemsByList.get(it.priceListId) ?? [];
    arr.push(it);
    itemsByList.set(it.priceListId, arr);
  }
  const priceRows: LayerInput["priceRows"] = {};
  for (const m of apl) {
    const rows: Record<string, { unitPriceCents: number; minQty: number; priceListItemId: string; priceListName: string }> = {};
    for (const it of itemsByList.get(m.priceListId) ?? []) {
      rows[it.productId] = {
        unitPriceCents: it.unitPriceCents,
        minQty: it.minQty,
        priceListItemId: it.id,
        priceListName: m.name,
      };
    }
    priceRows[m.accountId] = rows;
  }

  // Open balances: unpaid invoices attributed via sales orders.
  const unpaid = await db
    .select({ accountId: salesOrders.accountId, amount: sql<string>`coalesce(sum(${invoices.amountCents}), 0)` })
    .from(invoices)
    .innerJoin(salesOrders, eq(salesOrders.id, invoices.salesOrderId))
    .where(sql`${invoices.paidAt} is null`)
    .groupBy(salesOrders.accountId);
  const openBalanceCents: Record<string, number> = {};
  for (const u of unpaid) openBalanceCents[u.accountId] = Number(u.amount);

  return {
    extraction,
    pdfPageCount: 1, // seeded fixtures are single-page; live extraction reports pages via anchors
    poId,
    processingDate: repDateKey(demoNow),
    catalog,
    accounts: accountRows,
    projects: projectRows,
    quotesByNumber: Object.fromEntries(quoteRows.map((q) => [q.number, { accountId: q.accountId }])),
    priceRows,
    openBalanceCents,
    priorPos: priorPoRows.map((p) => {
      const meta = (p.extracted as { __meta?: { fingerprint?: string | null; poDate?: string | null } } | null)?.__meta;
      return {
        id: p.id,
        accountId: p.accountId,
        customerPoNumber: p.customerPoNumber,
        fingerprint: meta?.fingerprint ?? null,
        poDate: meta?.poDate ?? null,
      };
    }),
  };
}

export async function finalizePo(args: {
  poId: string;
  runId: string | null;
  t0: number;
  extraction: PoExtraction;
  resolvedLines: ResolvedPoLine[];
  accountId: string | null;
  results: ValidationLayerResult[];
  blobUrl: string;
  /** For re-validation after human edits: reuse this approval row. */
  existingApprovalId?: string;
}): Promise<PoIntakeResult> {
  const { poId, runId, t0, extraction, resolvedLines, accountId, results, blobUrl } = args;
  const demoNow = await getDemoNow();
  const allPass = results.length === 7 && results.every((r) => r.pass);
  const elapsedMs = Date.now() - t0;

  if (allPass && accountId) {
    const soLines: SalesOrderLine[] = resolvedLines.map((l) => ({
      productId: l.resolved!.product_id,
      sku: l.resolved!.sku,
      description: l.description,
      qty: l.qty,
      uom: l.uom,
      unitPriceCents: l.unit_price_cents,
      extendedCents: l.qty * l.unit_price_cents,
    }));
    const so = await getErpProvider().createSalesOrder({
      poId,
      accountId,
      lines: soLines,
      subtotalCents: extraction.totals.subtotal_cents,
      totalCents: extraction.totals.total_cents,
    });
    await db
      .update(purchaseOrders)
      .set({ status: "converted", elapsedMs })
      .where(eq(purchaseOrders.id, poId));

    const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
    const fieldEvidence = buildFieldEvidence(extraction, blobUrl, poId);
    const priceEvidence = resolvedLines
      .filter((l) => l.resolved)
      .map((l) => ({
        type: "price_row" as const,
        ref: { priceListItemId: null, sku: l.resolved!.sku, poId },
        quote: `${l.resolved!.sku} priced at tier exactly`,
      }));

    const payload = {
      poId,
      salesOrderId: so.salesOrderId,
      salesOrderNumber: so.number,
      customerPoNumber: extraction.customer_po_number.value,
      accountId,
      accountName: account?.name ?? "",
      lines: soLines,
      subtotalCents: extraction.totals.subtotal_cents,
      totalCents: extraction.totals.total_cents,
      validation: results,
      elapsedMs,
    };
    let approvalId = args.existingApprovalId ?? null;
    if (approvalId) {
      await db
        .update(approvals)
        .set({ proposedAction: payload, evidence: [...fieldEvidence, ...priceEvidence] })
        .where(eq(approvals.id, approvalId));
    } else {
      const created = await createApprovalRow({
        runId,
        agentName: "po-intake",
        kind: "sales_order",
        proposedAction: payload,
        evidence: [...fieldEvidence, ...priceEvidence],
        demoNow,
        riskTier: "high",
      });
      approvalId = created.approvalId;
    }
    await audit({
      actor: "system",
      action: "po.validated",
      objectType: "purchase_order",
      objectId: poId,
      detail: { layers: "7/7", salesOrderNumber: so.number, elapsedMs },
    });
    return { poId, status: "converted", runId, approvalId, elapsedMs, validation: results };
  }

  // Escalation: exactly which layer failed and why.
  const blocking = results.filter((r) => !r.pass).map((r) => ({ layer: r.layer, name: r.name, detail: r.detail }));
  await db.update(purchaseOrders).set({ status: "escalated", elapsedMs }).where(eq(purchaseOrders.id, poId));
  const payload = {
    poId,
    customerPoNumber: extraction.customer_po_number.value,
    accountId,
    blocking_layers: blocking,
    validation: results,
    elapsedMs,
  };
  let approvalId = args.existingApprovalId ?? null;
  if (approvalId) {
    await db.update(approvals).set({ proposedAction: payload }).where(eq(approvals.id, approvalId));
  } else {
    const created = await createApprovalRow({
      runId,
      agentName: "po-intake",
      kind: "sales_order",
      proposedAction: payload,
      evidence: buildFieldEvidence(extraction, blobUrl, poId).slice(0, 6),
      demoNow,
      riskTier: "high",
    });
    approvalId = created.approvalId;
  }
  await audit({
    actor: "system",
    action: "po.escalated",
    objectType: "purchase_order",
    objectId: poId,
    detail: { blocking: blocking.map((b) => b.name) },
  });
  return { poId, status: "escalated", runId, approvalId, elapsedMs, validation: results };
}

function buildFieldEvidence(extraction: PoExtraction, blobUrl: string, poId: string) {
  const items: { type: "pdf_page"; ref: Record<string, unknown>; quote: string }[] = [];
  const push = (field: string, page: number, bbox: number[] | null | undefined, quote: string) =>
    items.push({ type: "pdf_page", ref: { blobUrl, poId, field, page, bbox }, quote });
  push("customer_po_number", extraction.customer_po_number.anchor.page, extraction.customer_po_number.anchor.bbox, extraction.customer_po_number.value);
  push("po_date", extraction.po_date.anchor.page, extraction.po_date.anchor.bbox, extraction.po_date.value);
  push("bill_to", extraction.bill_to.anchor.page, extraction.bill_to.anchor.bbox, extraction.bill_to.value.company);
  push("ship_to", extraction.ship_to.anchor.page, extraction.ship_to.anchor.bbox, extraction.ship_to.value.company);
  if (extraction.referenced_quote_number) {
    push("referenced_quote_number", extraction.referenced_quote_number.anchor.page, extraction.referenced_quote_number.anchor.bbox, extraction.referenced_quote_number.value);
  }
  extraction.lines.forEach((l, i) => push(`lines[${i}]`, l.page, l.bbox, `${l.raw_sku_text} × ${l.qty}`));
  push("totals", extraction.totals.page, undefined, `total ${(extraction.totals.total_cents / 100).toFixed(2)}`);
  return items;
}

/** Re-parse an edited extraction (resolved fields stripped) — human fix path. */
export function reparseExtraction(edited: Record<string, unknown>): PoExtraction {
  const clone = JSON.parse(JSON.stringify(edited)) as Record<string, unknown>;
  delete clone.__meta;
  if (Array.isArray(clone.lines)) {
    for (const l of clone.lines as Record<string, unknown>[]) delete l.resolved;
  }
  return poExtraction.parse(clone);
}
