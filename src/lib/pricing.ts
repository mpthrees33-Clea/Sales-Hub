/**
 * Deterministic pricing (WO-05 task 1) — pure, tested, no LLM anywhere. The
 * model never computes a price; this module does, from price-list rows.
 * DemoErpProvider.getPrices delegates here (single source of pricing truth).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { accountPriceLists, priceListItems, priceLists, products } from "@/db/schema";
import { EscalationError } from "@/harness/errors";

export type PriceLineRequest = { productId: string; qty: number; uom?: string };

export type PricedLine = {
  productId: string;
  sku: string;
  /** The quantity as requested, before min-order-qty enforcement. */
  requestedQty: number;
  /** The effective quantity actually priced (>= the row's minQty). */
  qty: number;
  uom: string;
  unitPriceCents: number;
  extendedCents: number;
  minQty: number;
  priceListItemId: string;
  priceListId: string;
  priceListName: string;
  tier: "list" | "distributor" | "project";
};

export async function resolvePriceList(
  accountId: string,
): Promise<{ priceListId: string; name: string; tier: "list" | "distributor" | "project" }> {
  const mapped = await db
    .select({ priceListId: accountPriceLists.priceListId, name: priceLists.name, tier: priceLists.tier })
    .from(accountPriceLists)
    .innerJoin(priceLists, eq(priceLists.id, accountPriceLists.priceListId))
    .where(eq(accountPriceLists.accountId, accountId))
    .limit(1);
  if (mapped[0]) return mapped[0];
  // Fallback: list tier (docs/work-orders/WO-05 task 1).
  const fallback = await db.select().from(priceLists).where(eq(priceLists.tier, "list")).limit(1);
  if (!fallback[0]) throw new Error("no list-tier price list seeded");
  return { priceListId: fallback[0].id, name: fallback[0].name, tier: fallback[0].tier };
}

/**
 * Price lines for an account at its tier, integer cents throughout.
 * Missing price row → EscalationError('price_row_missing'); non-positive or
 * non-integer requested qty → EscalationError('invalid_qty'). The per-row
 * minimum order quantity is enforced: the effective `qty` is raised to `minQty`
 * (with `requestedQty` preserved) so the priced total reflects the real MOQ.
 * Grounded or it escalates — the model never computes a price.
 */
export async function priceLines(
  accountId: string,
  lines: PriceLineRequest[],
): Promise<{ lines: PricedLine[]; subtotalCents: number }> {
  if (lines.length === 0) return { lines: [], subtotalCents: 0 };
  const pl = await resolvePriceList(accountId);
  // Dedup product ids for the lookup; a request may list the same SKU twice.
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const rows = await db
    .select({
      productId: priceListItems.productId,
      sku: products.sku,
      unitPriceCents: priceListItems.unitPriceCents,
      minQty: priceListItems.minQty,
      priceListItemId: priceListItems.id,
    })
    .from(priceListItems)
    .innerJoin(products, eq(products.id, priceListItems.productId))
    .where(and(eq(priceListItems.priceListId, pl.priceListId), inArray(priceListItems.productId, productIds)));
  const byProduct = new Map(rows.map((r) => [r.productId, r]));

  const out: PricedLine[] = lines.map((line) => {
    const row = byProduct.get(line.productId);
    if (!row) {
      throw new EscalationError("price_row_missing", { productId: line.productId, priceList: pl.name });
    }
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new EscalationError("invalid_qty", { productId: line.productId, qty: line.qty });
    }
    const qty = Math.max(line.qty, row.minQty);
    return {
      productId: line.productId,
      sku: row.sku,
      requestedQty: line.qty,
      qty,
      uom: line.uom ?? "roll",
      unitPriceCents: row.unitPriceCents,
      extendedCents: qty * row.unitPriceCents,
      minQty: row.minQty,
      priceListItemId: row.priceListItemId,
      priceListId: pl.priceListId,
      priceListName: pl.name,
      tier: pl.tier,
    };
  });
  return { lines: out, subtotalCents: out.reduce((a, l) => a + l.extendedCents, 0) };
}
