/**
 * The seven validation layers (WO-06) — deterministic code steps, NOT
 * agents. No model call, no randomness, no wall-clock reads: every layer is
 * a pure function over a pre-loaded LayerInput, so identical input yields
 * byte-identical validation output (unit-asserted). Every layer always runs
 * and records; a layer starved by an earlier failure records
 * {pass:false, detail:{blocked_by}} so the checklist always shows all seven
 * verdicts.
 */
import type { PoExtraction, ResolvedPoLine } from "@/agents/po-intake";
import type { ValidationLayerResult } from "@/db/schema";
import { lineFingerprint, normalizeSku, skuCandidates, tokenSetSimilarity } from "./match";

export const LAYER_NAMES = [
  "schema_complete",
  "sku_resolution",
  "price_match",
  "qty_uom_sanity",
  "customer_shipto_match",
  "credit_terms",
  "duplicate_detection",
] as const;

export const ALLOWED_TERMS = ["Net 30", "Net 45", "50% Deposit"];
export const ACCOUNT_MATCH_THRESHOLD = 0.85;

export type LayerInput = {
  extraction: PoExtraction;
  pdfPageCount: number;
  poId: string;
  /** demo-clock date of processing (yyyy-mm-dd) — passed in, never read here. */
  processingDate: string;
  catalog: { productId: string; sku: string; name: string; unit: string }[];
  accounts: {
    id: string;
    name: string;
    address: { line1: string; city: string; state: string; zip: string };
    creditLimitCents: number;
  }[];
  projects: { accountId: string; name: string; address: { line1: string; city: string; state: string; zip: string } }[];
  quotesByNumber: Record<string, { accountId: string }>;
  /** Account's price rows keyed by accountId → productId. */
  priceRows: Record<
    string,
    Record<string, { unitPriceCents: number; minQty: number; priceListItemId: string; priceListName: string }>
  >;
  /** Unpaid invoice total per accountId (attributed via sales orders). */
  openBalanceCents: Record<string, number>;
  priorPos: {
    id: string;
    accountId: string | null;
    customerPoNumber: string | null;
    fingerprint: string | null;
    poDate: string | null;
  }[];
};

export type LayerOutcome = {
  results: ValidationLayerResult[];
  resolvedLines: ResolvedPoLine[];
  accountId: string | null;
};

export function runLayers(input: LayerInput): LayerOutcome {
  const results: ValidationLayerResult[] = [];
  const push = (layer: number, name: string, pass: boolean, detail: Record<string, unknown>) =>
    results.push({ layer, name, pass, detail, durationMs: 0 });

  const ex = input.extraction;
  const lines = ex.lines as ResolvedPoLine[];

  // ── Layer 1: schema_complete ───────────────────────────────────────────────
  {
    const problems: Record<string, unknown>[] = [];
    if (lines.length < 1) problems.push({ check: "line_count", expected: ">=1", found: lines.length });
    const anchors: { field: string; page: number }[] = [
      { field: "customer_po_number", page: ex.customer_po_number.anchor.page },
      { field: "po_date", page: ex.po_date.anchor.page },
      { field: "bill_to", page: ex.bill_to.anchor.page },
      { field: "ship_to", page: ex.ship_to.anchor.page },
      { field: "totals", page: ex.totals.page },
      ...lines.map((l, i) => ({ field: `lines[${i}]`, page: l.page })),
    ];
    for (const a of anchors) {
      if (a.page > input.pdfPageCount) {
        problems.push({ check: "anchor_page", field: a.field, expected: `<=${input.pdfPageCount}`, found: a.page });
      }
    }
    let computedSubtotal = 0;
    lines.forEach((l, i) => {
      const lineTotal = l.line_total_cents ?? l.qty * l.unit_price_cents;
      if (Math.abs(lineTotal - l.qty * l.unit_price_cents) > 1) {
        problems.push({
          check: "line_arithmetic",
          line: i,
          expected: l.qty * l.unit_price_cents,
          found: lineTotal,
        });
      }
      computedSubtotal += lineTotal;
    });
    if (Math.abs(computedSubtotal - ex.totals.subtotal_cents) > lines.length) {
      problems.push({ check: "subtotal", expected: computedSubtotal, found: ex.totals.subtotal_cents });
    }
    const expectedTotal = ex.totals.subtotal_cents + (ex.totals.tax_cents ?? 0);
    if (expectedTotal !== ex.totals.total_cents) {
      problems.push({ check: "total", expected: expectedTotal, found: ex.totals.total_cents });
    }
    push(1, "schema_complete", problems.length === 0, problems.length ? { problems } : {});
  }
  const l1pass = results[0]!.pass;

  // ── Layer 2: sku_resolution ────────────────────────────────────────────────
  let l2pass = false;
  {
    if (!l1pass) {
      push(2, "sku_resolution", false, { blocked_by: "schema_complete" });
    } else {
      const bySku = new Map(input.catalog.map((c) => [c.sku, c]));
      const byNorm = new Map(input.catalog.map((c) => [normalizeSku(c.sku), c]));
      const failures: Record<string, unknown>[] = [];
      for (const line of lines) {
        const exact = bySku.get(line.raw_sku_text.trim());
        const norm = exact ?? byNorm.get(normalizeSku(line.raw_sku_text));
        if (norm) {
          line.resolved = { product_id: norm.productId, sku: norm.sku, method: exact ? "exact" : "normalized" };
        } else {
          failures.push({
            raw_sku_text: line.raw_sku_text,
            candidates: skuCandidates(line.raw_sku_text, input.catalog),
          });
        }
      }
      l2pass = failures.length === 0;
      push(2, "sku_resolution", l2pass, l2pass ? { resolved: lines.length } : { failures });
    }
  }

  // ── Account resolution (shared by layers 3/5/6/7) ──────────────────────────
  const account = resolveAccount(input);

  // ── Layer 3: price_match (tolerance: 0) ────────────────────────────────────
  {
    if (!l2pass) {
      push(3, "price_match", false, { blocked_by: "sku_resolution" });
    } else if (!account) {
      push(3, "price_match", false, { reason: "account_unresolved" });
    } else {
      const rows = input.priceRows[account.id] ?? {};
      const bad: Record<string, unknown>[] = [];
      for (const line of lines) {
        const row = rows[line.resolved!.product_id];
        if (!row) {
          bad.push({ sku: line.resolved!.sku, reason: "price_row_missing", page: line.page });
          continue;
        }
        if (row.unitPriceCents !== line.unit_price_cents) {
          bad.push({
            sku: line.resolved!.sku,
            expected_cents: row.unitPriceCents,
            found_cents: line.unit_price_cents,
            price_list_name: row.priceListName,
            price_list_item_id: row.priceListItemId,
            page: line.page,
          });
        }
      }
      push(3, "price_match", bad.length === 0, bad.length ? { mismatches: bad } : { priceList: Object.values(rows)[0]?.priceListName });
    }
  }

  // ── Layer 4: qty_uom_sanity ────────────────────────────────────────────────
  {
    if (!l2pass) {
      push(4, "qty_uom_sanity", false, { blocked_by: "sku_resolution" });
    } else {
      const unitSet = new Set(input.catalog.map((c) => c.unit));
      const byId = new Map(input.catalog.map((c) => [c.productId, c]));
      const rows = account ? (input.priceRows[account.id] ?? {}) : {};
      const bad: Record<string, unknown>[] = [];
      for (const line of lines) {
        const product = byId.get(line.resolved!.product_id)!;
        if (!(line.qty > 0)) bad.push({ sku: product.sku, check: "qty_positive", found: line.qty });
        if (!Number.isInteger(line.qty)) bad.push({ sku: product.sku, check: "qty_integer", found: line.qty });
        if (!unitSet.has(line.uom)) bad.push({ sku: product.sku, check: "uom_known", found: line.uom });
        else if (line.uom !== product.unit) {
          bad.push({ sku: product.sku, check: "uom_matches_product", expected: product.unit, found: line.uom });
        }
        const minQty = rows[line.resolved!.product_id]?.minQty;
        if (minQty && line.qty < minQty) {
          bad.push({ sku: product.sku, check: "min_qty", expected: `>=${minQty}`, found: line.qty });
        }
      }
      push(4, "qty_uom_sanity", bad.length === 0, bad.length ? { problems: bad } : {});
    }
  }

  // ── Layer 5: customer_shipto_match ─────────────────────────────────────────
  {
    if (!account) {
      const scored = input.accounts
        .map((a) => ({ name: a.name, score: round2(tokenSetSimilarity(ex.bill_to.value.company, a.name)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      push(5, "customer_shipto_match", false, {
        reason: "bill_to_below_threshold",
        threshold: ACCOUNT_MATCH_THRESHOLD,
        candidates: scored,
      });
    } else {
      const ship = ex.ship_to.value;
      const addrCandidates = [
        account.address,
        ...input.projects.filter((p) => p.accountId === account.id).map((p) => p.address),
      ];
      const shipCompanyOk = tokenSetSimilarity(ship.company, account.name) >= ACCOUNT_MATCH_THRESHOLD;
      const shipAddrOk = addrCandidates.some(
        (a) =>
          tokenSetSimilarity(`${ship.line1} ${ship.city}`, `${a.line1} ${a.city}`) >= ACCOUNT_MATCH_THRESHOLD ||
          (ship.zip === a.zip && tokenSetSimilarity(ship.line1, a.line1) >= 0.5),
      );
      const pass = shipCompanyOk || shipAddrOk;
      push(
        5,
        "customer_shipto_match",
        pass,
        pass
          ? { account: account.name, matchedVia: shipCompanyOk ? "ship_to_company" : "ship_to_address" }
          : {
              account: account.name,
              reason: "ship_to_unmatched",
              ship_to: `${ship.company} · ${ship.line1}, ${ship.city}`,
            },
      );
    }
  }

  // ── Layer 6: credit_terms ──────────────────────────────────────────────────
  {
    if (!account) {
      push(6, "credit_terms", false, { blocked_by: "customer_shipto_match" });
    } else {
      const problems: Record<string, unknown>[] = [];
      const terms = ex.terms?.value;
      if (terms && !ALLOWED_TERMS.includes(terms)) {
        problems.push({ check: "terms_allowed", expected: ALLOWED_TERMS, found: terms });
      }
      // Placeholder open-balance rule, deterministic (documented stand-in for a
      // real credit integration): unpaid invoices + PO total ≤ credit limit.
      const open = input.openBalanceCents[account.id] ?? 0;
      if (open + ex.totals.total_cents > account.creditLimitCents) {
        problems.push({
          check: "credit_limit",
          openBalanceCents: open,
          poTotalCents: ex.totals.total_cents,
          creditLimitCents: account.creditLimitCents,
        });
      }
      push(6, "credit_terms", problems.length === 0, problems.length ? { problems } : { terms: terms ?? "(none stated)" });
    }
  }

  // ── Layer 7: duplicate_detection ───────────────────────────────────────────
  {
    if (!l2pass || !account) {
      push(7, "duplicate_detection", false, { blocked_by: !l2pass ? "sku_resolution" : "customer_shipto_match" });
    } else {
      const fp = lineFingerprint(
        lines.map((l) => ({
          product_id: l.resolved!.product_id,
          qty: l.qty,
          unit_price_cents: l.unit_price_cents,
        })),
      );
      const poDate = ex.po_date.value;
      const dupes = input.priorPos.filter((p) => {
        if (p.id === input.poId) return false;
        const samePoNumber = p.accountId === account.id && p.customerPoNumber === ex.customer_po_number.value;
        const sameFingerprint =
          p.fingerprint === fp && p.poDate != null && Math.abs(daysBetween(p.poDate, poDate)) <= 14;
        return samePoNumber || sameFingerprint;
      });
      push(
        7,
        "duplicate_detection",
        dupes.length === 0,
        dupes.length ? { duplicates: dupes.map((d) => ({ poId: d.id, customerPoNumber: d.customerPoNumber })) } : { fingerprint: fp.slice(0, 16) },
      );
    }
  }

  return { results, resolvedLines: lines, accountId: account?.id ?? null };
}

/** Quote lookup first, then fuzzy bill_to company (threshold 0.85). */
export function resolveAccount(input: LayerInput): LayerInput["accounts"][number] | null {
  const ref = input.extraction.referenced_quote_number?.value;
  if (ref && input.quotesByNumber[ref]) {
    const acct = input.accounts.find((a) => a.id === input.quotesByNumber[ref]!.accountId);
    if (acct) return acct;
  }
  const company = input.extraction.bill_to.value.company;
  let best: { acct: LayerInput["accounts"][number]; score: number } | null = null;
  for (const a of input.accounts) {
    const score = tokenSetSimilarity(company, a.name);
    if (!best || score > best.score) best = { acct: a, score };
  }
  return best && best.score >= ACCOUNT_MATCH_THRESHOLD ? best.acct : null;
}

function daysBetween(a: string, b: string): number {
  return (new Date(a + "T00:00:00Z").getTime() - new Date(b + "T00:00:00Z").getTime()) / 86_400_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
