/**
 * The seven deterministic PO validation layers (WO-06 tasks 4–10). The model
 * extracts; THESE check. No model call, no randomness, no wall-clock read
 * (duration is timed by the workflow, not here) — same input ⇒ byte-identical
 * verdicts. Each returns `{layer, name, pass, detail}`; every layer always runs
 * (blocked layers record `{blocked_by}`) so the checklist shows all seven.
 */
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accountPriceLists,
  accounts,
  invoices,
  priceListItems,
  priceLists,
  products,
  projects,
  purchaseOrders,
  quotes,
  salesOrders,
} from "@/db/schema";
import type { PoExtraction } from "@/agents/po-intake";
import { lineFingerprint, nearestSkus, normalizeSku, tokenSetSimilarity } from "./match";

export type LayerVerdict = { layer: number; name: string; pass: boolean; detail: Record<string, unknown> };
export type LayerCtx = { extraction: PoExtraction; poId: string; demoNow: Date; pageCount: number };

const ALLOWED_TERMS = ["Net 30", "Net 45", "50% Deposit"];
const SHIPTO_THRESHOLD = 0.85;

type Resolved = { accountId: string; name: string; method: "quote" | "fuzzy"; score?: number } | null;

/** Shared account resolution: referenced quote first, else fuzzy bill_to.company. */
async function resolveAccount(ex: PoExtraction): Promise<Resolved> {
  const refQuote = ex.referenced_quote_number?.value;
  if (refQuote) {
    const [q] = await db.select({ accountId: quotes.accountId }).from(quotes).where(eq(quotes.number, refQuote)).limit(1);
    if (q) {
      const [a] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, q.accountId)).limit(1);
      return { accountId: q.accountId, name: a?.name ?? "", method: "quote" };
    }
  }
  const company = ex.bill_to.value.company;
  const all = await db.select({ id: accounts.id, name: accounts.name }).from(accounts);
  let best: { id: string; name: string; score: number } | null = null;
  for (const a of all) {
    const score = tokenSetSimilarity(company, a.name);
    if (!best || score > best.score) best = { id: a.id, name: a.name, score };
  }
  if (best && best.score >= SHIPTO_THRESHOLD) return { accountId: best.id, name: best.name, method: "fuzzy", score: best.score };
  return null;
}

// ── Layer 1 ──────────────────────────────────────────────────────────────────
export function layer1SchemaComplete(ctx: LayerCtx): LayerVerdict {
  const ex = ctx.extraction;
  const issues: string[] = [];
  if (ex.lines.length < 1) issues.push("no line items");

  const anchorsOk = [ex.customer_po_number.anchor.page, ex.po_date.anchor.page, ex.totals.page, ...ex.lines.map((l) => l.page)].every((p) => p >= 1 && p <= ctx.pageCount);
  if (!anchorsOk) issues.push(`anchor page out of range (pdf has ${ctx.pageCount} pages)`);

  let computed = 0;
  for (const l of ex.lines) {
    const ext = l.line_total_cents ?? l.qty * l.unit_price_cents;
    if (Math.abs(ext - l.qty * l.unit_price_cents) > 1) issues.push(`line ${l.raw_sku_text}: extended ${ext} ≠ qty×unit ${l.qty * l.unit_price_cents}`);
    computed += l.qty * l.unit_price_cents;
  }
  if (Math.abs(computed - ex.totals.subtotal_cents) > ex.lines.length) {
    issues.push(`subtotal ${ex.totals.subtotal_cents} ≠ Σ lines ${computed}`);
  }
  const tax = ex.totals.tax_cents ?? 0;
  if (ex.totals.subtotal_cents + tax !== ex.totals.total_cents) {
    issues.push(`subtotal+tax ${ex.totals.subtotal_cents + tax} ≠ total ${ex.totals.total_cents}`);
  }
  return { layer: 1, name: "schema_complete", pass: issues.length === 0, detail: issues.length ? { issues } : { lines: ex.lines.length } };
}

// ── Layer 2 ──────────────────────────────────────────────────────────────────
export async function layer2SkuResolution(ctx: LayerCtx): Promise<LayerVerdict> {
  const catalog = await db.select({ id: products.id, sku: products.sku, name: products.name }).from(products);
  const bySku = new Map(catalog.map((p) => [p.sku.toUpperCase(), p]));
  const byNorm = new Map(catalog.map((p) => [normalizeSku(p.sku), p]));

  const unresolved: { raw: string; page: number; candidates: unknown[] }[] = [];
  for (const line of ctx.extraction.lines) {
    const exact = bySku.get(line.raw_sku_text.toUpperCase());
    const norm = exact ?? byNorm.get(normalizeSku(line.raw_sku_text));
    if (norm) {
      line.resolved = { product_id: norm.id, sku: norm.sku, method: exact ? "exact" : "normalized" };
    } else {
      unresolved.push({ raw: line.raw_sku_text, page: line.page, candidates: nearestSkus(line.raw_sku_text, catalog) });
    }
  }
  return { layer: 2, name: "sku_resolution", pass: unresolved.length === 0, detail: unresolved.length ? { unresolved } : { resolved: ctx.extraction.lines.length } };
}

// ── Layer 3 ──────────────────────────────────────────────────────────────────
export async function layer3PriceMatch(ctx: LayerCtx): Promise<LayerVerdict> {
  const account = await resolveAccount(ctx.extraction);
  if (!account) return { layer: 3, name: "price_match", pass: false, detail: { blocked_by: "customer_shipto_match", reason: "account unresolved" } };
  const resolvedLines = ctx.extraction.lines.filter((l) => l.resolved);
  if (resolvedLines.length !== ctx.extraction.lines.length) return { layer: 3, name: "price_match", pass: false, detail: { blocked_by: "sku_resolution" } };

  const [apl] = await db.select({ priceListId: accountPriceLists.priceListId, name: priceLists.name }).from(accountPriceLists).innerJoin(priceLists, eq(priceLists.id, accountPriceLists.priceListId)).where(eq(accountPriceLists.accountId, account.accountId)).limit(1);
  const priceListId = apl?.priceListId ?? (await db.select({ id: priceLists.id }).from(priceLists).where(eq(priceLists.tier, "list")).limit(1))[0]!.id;
  const priceListName = apl?.name ?? "Standard List";
  const productIds = ctx.extraction.lines.map((l) => l.resolved!.product_id);
  const rows = await db.select({ productId: priceListItems.productId, unitPriceCents: priceListItems.unitPriceCents, id: priceListItems.id }).from(priceListItems).where(and(eq(priceListItems.priceListId, priceListId), inArray(priceListItems.productId, productIds)));
  const byProduct = new Map(rows.map((r) => [r.productId, r]));

  const mismatches: unknown[] = [];
  for (const l of ctx.extraction.lines) {
    const row = byProduct.get(l.resolved!.product_id);
    if (!row) {
      mismatches.push({ sku: l.resolved!.sku, page: l.page, reason: "no price-list row" });
      continue;
    }
    if (row.unitPriceCents !== l.unit_price_cents) {
      mismatches.push({ sku: l.resolved!.sku, expected_cents: row.unitPriceCents, found_cents: l.unit_price_cents, price_list_name: priceListName, price_list_item_id: row.id, page: l.page });
    }
  }
  return { layer: 3, name: "price_match", pass: mismatches.length === 0, detail: mismatches.length ? { mismatches, account: account.name } : { account: account.name, price_list: priceListName } };
}

// ── Layer 4 ──────────────────────────────────────────────────────────────────
export async function layer4QtyUomSanity(ctx: LayerCtx): Promise<LayerVerdict> {
  const resolved = ctx.extraction.lines.every((l) => l.resolved);
  if (!resolved) return { layer: 4, name: "qty_uom_sanity", pass: false, detail: { blocked_by: "sku_resolution" } };
  const productIds = ctx.extraction.lines.map((l) => l.resolved!.product_id);
  const prods = await db.select({ id: products.id, unit: products.unit }).from(products).where(inArray(products.id, productIds));
  const unitById = new Map(prods.map((p) => [p.id, p.unit]));

  const issues: unknown[] = [];
  for (const l of ctx.extraction.lines) {
    if (l.qty <= 0) issues.push({ sku: l.resolved!.sku, reason: "qty ≤ 0" });
    if (!Number.isInteger(l.qty)) issues.push({ sku: l.resolved!.sku, reason: "qty not integer" });
    const unit = unitById.get(l.resolved!.product_id);
    if (unit && l.uom.toLowerCase() !== unit.toLowerCase()) issues.push({ sku: l.resolved!.sku, reason: `uom ${l.uom} ≠ product unit ${unit}` });
  }
  return { layer: 4, name: "qty_uom_sanity", pass: issues.length === 0, detail: issues.length ? { issues } : { ok: ctx.extraction.lines.length } };
}

// ── Layer 5 ──────────────────────────────────────────────────────────────────
export async function layer5CustomerShiptoMatch(ctx: LayerCtx): Promise<LayerVerdict> {
  const company = ctx.extraction.bill_to.value.company;
  const all = await db.select({ id: accounts.id, name: accounts.name }).from(accounts);
  const scored = all.map((a) => ({ ...a, score: tokenSetSimilarity(company, a.name) })).sort((x, y) => y.score - x.score);
  const top = scored[0];
  if (!top || top.score < SHIPTO_THRESHOLD) {
    return { layer: 5, name: "customer_shipto_match", pass: false, detail: { bill_to: company, candidates: scored.slice(0, 3).map((c) => ({ name: c.name, score: Math.round(c.score * 100) / 100 })) } };
  }
  // ship_to city/state should match the account or one of its projects.
  const shipCity = ctx.extraction.ship_to.value.city.toLowerCase();
  const acctAddr = await db.select({ address: accounts.address }).from(accounts).where(eq(accounts.id, top.id)).limit(1);
  const projRows = await db.select({ address: projects.address }).from(projects).where(eq(projects.accountId, top.id));
  const cities = [acctAddr[0]?.address?.city, ...projRows.map((p) => p.address?.city)].filter(Boolean).map((c) => String(c).toLowerCase());
  const shipOk = cities.length === 0 || cities.includes(shipCity);
  return { layer: 5, name: "customer_shipto_match", pass: shipOk, detail: { account: top.name, score: Math.round(top.score * 100) / 100, ship_to_city: ctx.extraction.ship_to.value.city, ship_to_matched: shipOk } };
}

// ── Layer 6 ──────────────────────────────────────────────────────────────────
export async function layer6CreditTerms(ctx: LayerCtx): Promise<LayerVerdict> {
  const terms = ctx.extraction.terms?.value;
  if (terms && !ALLOWED_TERMS.includes(terms)) {
    return { layer: 6, name: "credit_terms", pass: false, detail: { terms, allowed: ALLOWED_TERMS } };
  }
  const account = await resolveAccount(ctx.extraction);
  if (!account) return { layer: 6, name: "credit_terms", pass: false, detail: { blocked_by: "customer_shipto_match" } };
  const [acct] = await db.select({ creditLimitCents: accounts.creditLimitCents }).from(accounts).where(eq(accounts.id, account.accountId)).limit(1);
  // Open balance attributed to THIS account via sales-order linkage.
  const unpaid = await db
    .select({ amountCents: invoices.amountCents })
    .from(invoices)
    .innerJoin(salesOrders, eq(salesOrders.id, invoices.salesOrderId))
    .where(and(eq(salesOrders.accountId, account.accountId), isNull(invoices.paidAt)));
  const open = unpaid.reduce((a, i) => a + i.amountCents, 0);
  const exposure = open + ctx.extraction.totals.total_cents;
  const limit = acct?.creditLimitCents ?? 25_000_000;
  const ok = exposure <= limit;
  return { layer: 6, name: "credit_terms", pass: ok, detail: { terms: terms ?? "n/a", exposure_cents: exposure, credit_limit_cents: limit, ok, note: "placeholder credit rule" } };
}

// ── Layer 7 ──────────────────────────────────────────────────────────────────
export async function layer7DuplicateDetection(ctx: LayerCtx): Promise<LayerVerdict> {
  const account = await resolveAccount(ctx.extraction);
  const poNumber = ctx.extraction.customer_po_number.value;
  const prior = await db
    .select({ id: purchaseOrders.id, customerPoNumber: purchaseOrders.customerPoNumber, accountId: purchaseOrders.accountId, extracted: purchaseOrders.extracted })
    .from(purchaseOrders)
    .where(and(ne(purchaseOrders.id, ctx.poId)));

  const resolved = ctx.extraction.lines.every((l) => l.resolved);
  const fp = resolved ? lineFingerprint(ctx.extraction.lines.map((l) => ({ productId: l.resolved!.product_id, qty: l.qty, unitPriceCents: l.unit_price_cents }))) : null;

  for (const p of prior) {
    const samePoNumber = account && p.accountId === account.accountId && p.customerPoNumber === poNumber;
    const priorFp = (p.extracted as { fingerprint?: string } | null)?.fingerprint;
    const sameFingerprint = fp != null && priorFp === fp;
    if (samePoNumber || sameFingerprint) {
      return { layer: 7, name: "duplicate_detection", pass: false, detail: { prior_po_id: p.id, reason: samePoNumber ? "same account + PO number" : "identical line fingerprint" } };
    }
  }
  return { layer: 7, name: "duplicate_detection", pass: true, detail: { fingerprint: fp ?? "unresolved" } };
}

/** Run all seven layers in order (mutating extraction with resolved SKUs). */
export async function runAllLayers(ctx: LayerCtx): Promise<LayerVerdict[]> {
  return [
    layer1SchemaComplete(ctx),
    await layer2SkuResolution(ctx),
    await layer3PriceMatch(ctx),
    await layer4QtyUomSanity(ctx),
    await layer5CustomerShiptoMatch(ctx),
    await layer6CreditTerms(ctx),
    await layer7DuplicateDetection(ctx),
  ];
}

export { resolveAccount };
