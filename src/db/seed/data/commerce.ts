/**
 * Deterministic commerce scenario: the outstanding quote Q-1042 (Piedmont),
 * the two staged PO fixtures (clean happy-path + layer-3 price mismatch), and
 * the 8-week order/invoice history shaped to KPI targets. All prices derive
 * from the catalog's tier math — fixtures stay consistent by construction.
 */
import { CATALOG, skuOf, tierPriceCents, type CatalogEntry } from "./catalog";
import {
  CURRENT_WEEK_CREATED_CENTS,
  CURRENT_WEEK_INVOICED_CENTS,
  HISTORY_WEEK_MONDAYS,
  CURRENT_WEEK_MONDAY,
  PO_CLEAN_NUMBER,
  PO_MISMATCH_NUMBER,
  QUOTE_1042_NUMBER,
  WEEKLY_CREATED_CENTS,
  WEEKLY_INVOICED_CENTS,
} from "../scenario";
import { shash } from "../ids";

export function bySku(sku: string): CatalogEntry {
  const c = CATALOG.find((x) => x.sku === sku);
  if (!c) throw new Error(`catalog: unknown sku ${sku}`);
  return c;
}

export function distributorPrice(sku: string): number {
  return tierPriceCents(bySku(sku).listPriceCents, "distributor");
}
export function projectPrice(sku: string): number {
  return tierPriceCents(bySku(sku).listPriceCents, "project");
}
export function listPrice(sku: string): number {
  return bySku(sku).listPriceCents;
}

// ── Q-1042: outstanding quote to Piedmont Surface Distribution ───────────────

export type ScenarioLine = { sku: string; name: string; qty: number; unitPriceCents: number };

export const Q1042_LINES: ScenarioLine[] = [
  { sku: skuOf("Walnut Grain"), name: "Walnut Grain", qty: 24, unitPriceCents: distributorPrice(skuOf("Walnut Grain")) },
  { sku: skuOf("White Oak"), name: "White Oak", qty: 18, unitPriceCents: distributorPrice(skuOf("White Oak")) },
  { sku: skuOf("Brushed Steel"), name: "Brushed Steel", qty: 10, unitPriceCents: distributorPrice(skuOf("Brushed Steel")) },
  { sku: skuOf("Matte White"), name: "Matte White", qty: 30, unitPriceCents: distributorPrice(skuOf("Matte White")) },
  { sku: skuOf("Linen Weave"), name: "Linen Weave", qty: 12, unitPriceCents: distributorPrice(skuOf("Linen Weave")) },
];

export function linesSubtotal(lines: ScenarioLine[]): number {
  return lines.reduce((a, l) => a + l.qty * l.unitPriceCents, 0);
}

// ── The two staged POs (docs/04 §2.3) ────────────────────────────────────────

/** Mismatch PO: Piedmont, references Q-1042, line 3 unit price is stale (−$40). */
export const PO_MISMATCH = {
  number: PO_MISMATCH_NUMBER,
  accountKey: "di-piedmont",
  referencedQuote: QUOTE_1042_NUMBER,
  poDate: "2026-03-09",
  terms: "Net 30",
  lines: Q1042_LINES.map((l, i) =>
    i === 2 ? { ...l, unitPriceCents: l.unitPriceCents - 4_000 } : { ...l },
  ),
};

/** Clean PO: Carolina Architectural Products, no referenced quote, exact tier prices. */
export const PO_CLEAN = {
  number: PO_CLEAN_NUMBER,
  accountKey: "di-carolina",
  referencedQuote: null as string | null,
  poDate: "2026-03-09",
  terms: "Net 30",
  lines: [
    { sku: skuOf("Teak"), name: "Teak", qty: 16, unitPriceCents: distributorPrice(skuOf("Teak")) },
    { sku: skuOf("Slate"), name: "Slate", qty: 8, unitPriceCents: distributorPrice(skuOf("Slate")) },
    { sku: skuOf("Charcoal"), name: "Charcoal", qty: 20, unitPriceCents: distributorPrice(skuOf("Charcoal")) },
  ] as ScenarioLine[],
};

// ── 8-week order/invoice history shaped to targets ───────────────────────────

export type HistoryOrder = {
  key: string;
  accountKey: string;
  weekMonday: string;
  dayOffset: number; // 0=Mon … 4=Fri
  lines: ScenarioLine[];
  totalCents: number;
  invoice?: { dayOffset: number; weekMonday: string };
};

/**
 * Split a weekly total across 3–5 orders over believable accounts. Line
 * quantities are back-solved so order totals hit the weekly numbers exactly
 * (KPI tests assert them).
 */
function buildHistory(): HistoryOrder[] {
  const orderAccounts = [
    "di-piedmont",
    "di-carolina",
    "di-tristate",
    "di-metrolina",
    "di-capital",
    "gc-stonebridge",
    "gc-keystone",
    "gc-whitaker",
    "di-gatecity",
    "di-southern",
    "gc-redoak",
    "di-eastfork",
  ];
  const out: HistoryOrder[] = [];
  const weeks: { monday: string; created: number; invoiced: number }[] = [
    ...HISTORY_WEEK_MONDAYS.map((m, i) => ({
      monday: m,
      created: WEEKLY_CREATED_CENTS[i]!,
      invoiced: WEEKLY_INVOICED_CENTS[i]!,
    })),
    { monday: CURRENT_WEEK_MONDAY, created: CURRENT_WEEK_CREATED_CENTS, invoiced: CURRENT_WEEK_INVOICED_CENTS },
  ];

  weeks.forEach((week, wi) => {
    const isCurrent = week.monday === CURRENT_WEEK_MONDAY;
    const n = isCurrent ? 3 : 3 + (shash(`orders:${week.monday}`, 3) as 0 | 1 | 2); // 3–5
    // Deterministic split of the weekly total into n chunks of whole $100s.
    const chunkBase = Math.floor(week.created / n / 10_000) * 10_000;
    const chunks = Array.from({ length: n }, (_, i) =>
      i === n - 1 ? week.created - chunkBase * (n - 1) : chunkBase,
    );
    chunks.forEach((chunk, ci) => {
      const accountKey = orderAccounts[(wi * 5 + ci * 3) % orderAccounts.length]!;
      const productA = CATALOG[(wi * 7 + ci * 11) % CATALOG.length]!;
      const tier = accountKey.startsWith("di-") ? "distributor" : "project";
      const unitPrice = tierPriceCents(productA.listPriceCents, tier);
      const qty = Math.max(1, Math.floor(chunk / unitPrice));
      const remainder = chunk - qty * unitPrice;
      const lines: ScenarioLine[] = [
        { sku: productA.sku, name: productA.name, qty, unitPriceCents: unitPrice },
      ];
      if (remainder > 0) {
        // Absorb the remainder in a filler line at an adjusted unit price so
        // the order total lands exactly on the chunk.
        const productB = CATALOG[(wi * 13 + ci * 17 + 5) % CATALOG.length]!;
        lines.push({ sku: productB.sku, name: productB.name, qty: 1, unitPriceCents: remainder });
      }
      out.push({
        key: `hist:${week.monday}:${ci}`,
        accountKey,
        weekMonday: week.monday,
        dayOffset: isCurrent ? 0 : ci % 5,
        lines,
        totalCents: chunk,
        invoice: undefined,
      });
    });

    // Invoices: mirror the invoiced total in 2–3 invoices tied to this week's
    // orders (or standalone service invoices for exactness).
    const invN = isCurrent ? 2 : 2 + (shash(`inv:${week.monday}`, 2) as 0 | 1);
    const invBase = Math.floor(week.invoiced / invN / 10_000) * 10_000;
    for (let ii = 0; ii < invN; ii++) {
      const amount = ii === invN - 1 ? week.invoiced - invBase * (invN - 1) : invBase;
      out.push({
        key: `histinv:${week.monday}:${ii}`,
        accountKey: orderAccounts[(wi * 3 + ii * 7 + 1) % orderAccounts.length]!,
        weekMonday: week.monday,
        dayOffset: isCurrent ? 0 : (ii * 2 + 1) % 5,
        lines: [],
        totalCents: amount,
        invoice: { dayOffset: isCurrent ? 0 : (ii * 2 + 1) % 5, weekMonday: week.monday },
      });
    }
  });
  return out;
}

export const HISTORY: HistoryOrder[] = buildHistory();
