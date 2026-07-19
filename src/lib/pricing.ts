/**
 * Deterministic pricing (WO-05 task 1) — "business grounding, deterministic
 * math". The model NEVER computes a price; this pure module does, from
 * price-list rows. A missing row escalates (never a guessed price).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { accountPriceLists, priceListItems, priceLists } from "@/db/schema";
import { EscalationError } from "@/harness/errors";

export type ResolvedPriceList = { priceListId: string; name: string; tier: "list" | "distributor" | "project" };

/** The account's price list via account_price_lists; falls back to the `list` tier. */
export async function resolvePriceList(accountId: string): Promise<ResolvedPriceList> {
  const [mapped] = await db
    .select({ priceListId: accountPriceLists.priceListId, name: priceLists.name, tier: priceLists.tier })
    .from(accountPriceLists)
    .innerJoin(priceLists, eq(priceLists.id, accountPriceLists.priceListId))
    .where(eq(accountPriceLists.accountId, accountId))
    .limit(1);
  if (mapped) return mapped;
  const [fallback] = await db.select().from(priceLists).where(eq(priceLists.tier, "list")).limit(1);
  if (!fallback) throw new Error("no list-tier price list seeded");
  return { priceListId: fallback.id, name: fallback.name, tier: fallback.tier };
}

export type QuoteLineRequest = { productId: string; qty: number; uom?: string };
export type PricedLine = {
  productId: string;
  requestedQty: number;
  /** Effective quantity after min-qty enforcement (>= minQty). */
  qty: number;
  uom: string;
  unitPriceCents: number;
  minQty: number;
  priceListItemId: string;
  extendedCents: number;
};
export type PricedQuote = {
  priceListId: string;
  tier: string;
  lines: PricedLine[];
  subtotalCents: number;
  totalCents: number;
};

/**
 * Price a set of requested lines against the account's price list. Enforces the
 * per-row minimum order quantity. Throws EscalationError('price_row_missing')
 * when a product has no row on the resolved list — never a guessed price.
 */
export async function priceLines(accountId: string, lines: QuoteLineRequest[]): Promise<PricedQuote> {
  const pl = await resolvePriceList(accountId);
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const rows = productIds.length
    ? await db
        .select({ productId: priceListItems.productId, unitPriceCents: priceListItems.unitPriceCents, minQty: priceListItems.minQty, id: priceListItems.id })
        .from(priceListItems)
        .where(and(eq(priceListItems.priceListId, pl.priceListId), inArray(priceListItems.productId, productIds)))
    : [];
  const byProduct = new Map(rows.map((r) => [r.productId, r]));

  const priced: PricedLine[] = lines.map((l) => {
    const row = byProduct.get(l.productId);
    if (!row) throw new EscalationError("price_row_missing", { productId: l.productId, priceList: pl.name });
    const qty = Math.max(l.qty, row.minQty);
    return {
      productId: l.productId,
      requestedQty: l.qty,
      qty,
      uom: l.uom ?? "roll",
      unitPriceCents: row.unitPriceCents,
      minQty: row.minQty,
      priceListItemId: row.id,
      extendedCents: row.unitPriceCents * qty,
    };
  });

  const subtotalCents = priced.reduce((a, l) => a + l.extendedCents, 0);
  return { priceListId: pl.priceListId, tier: pl.tier, lines: priced, subtotalCents, totalCents: subtotalCents };
}
