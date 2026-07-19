import { desc, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accountPriceLists,
  inventory,
  invoices,
  priceListItems,
  priceLists,
  products,
  quotes,
  salesOrders,
  submittalPackages,
} from "@/db/schema";
import { EscalationError } from "@/harness/errors";
import type { ErpProvider, PriceRow, StockRow } from "./types";
import type { SalesOrderLine } from "@/db/schema";

const NUMBER_STARTS: Record<string, number> = { Q: 1043, SO: 2050, INV: 5001, SUB: 101 };

export class DemoErpProvider implements ErpProvider {
  async checkStock(productIds: string[]): Promise<StockRow[]> {
    if (productIds.length === 0) return [];
    const rows = await db
      .select({
        productId: inventory.productId,
        sku: products.sku,
        onHand: inventory.onHand,
        allocated: inventory.allocated,
        leadTimeDays: inventory.leadTimeDays,
        restockAt: inventory.restockAt,
        inventoryRowId: inventory.id,
      })
      .from(inventory)
      .innerJoin(products, eq(products.id, inventory.productId))
      .where(inArray(inventory.productId, productIds));
    return rows.map((r) => ({ ...r, available: r.onHand - r.allocated }));
  }

  async resolvePriceList(accountId: string): Promise<{ priceListId: string; name: string; tier: string }> {
    const mapped = await db
      .select({ priceListId: accountPriceLists.priceListId, name: priceLists.name, tier: priceLists.tier })
      .from(accountPriceLists)
      .innerJoin(priceLists, eq(priceLists.id, accountPriceLists.priceListId))
      .where(eq(accountPriceLists.accountId, accountId))
      .limit(1);
    if (mapped[0]) return mapped[0];
    const fallback = await db.select().from(priceLists).where(eq(priceLists.tier, "list")).limit(1);
    if (!fallback[0]) throw new Error("no list-tier price list seeded");
    return { priceListId: fallback[0].id, name: fallback[0].name, tier: fallback[0].tier };
  }

  async getPrices(accountId: string, items: { productId: string; qty: number }[]): Promise<PriceRow[]> {
    if (items.length === 0) return [];
    const pl = await this.resolvePriceList(accountId);
    const rows = await db
      .select({
        productId: priceListItems.productId,
        sku: products.sku,
        unitPriceCents: priceListItems.unitPriceCents,
        minQty: priceListItems.minQty,
        priceListItemId: priceListItems.id,
        priceListId: priceListItems.priceListId,
      })
      .from(priceListItems)
      .innerJoin(products, eq(products.id, priceListItems.productId))
      .where(
        sql`${priceListItems.priceListId} = ${pl.priceListId} and ${inArray(
          priceListItems.productId,
          items.map((i) => i.productId),
        )}`,
      );
    const byProduct = new Map(rows.map((r) => [r.productId, r]));
    return items.map((item) => {
      const row = byProduct.get(item.productId);
      if (!row) {
        throw new EscalationError("price_row_missing", { productId: item.productId, priceList: pl.name });
      }
      return {
        ...row,
        priceListName: pl.name,
        tier: pl.tier as PriceRow["tier"],
      };
    });
  }

  async createSalesOrder(so: {
    poId?: string;
    accountId: string;
    lines: SalesOrderLine[];
    subtotalCents: number;
    totalCents: number;
  }): Promise<{ salesOrderId: string; number: string }> {
    const number = await this.nextNumber("SO");
    const [row] = await db
      .insert(salesOrders)
      .values({
        poId: so.poId,
        accountId: so.accountId,
        number,
        lines: so.lines,
        subtotalCents: so.subtotalCents,
        totalCents: so.totalCents,
        status: "draft",
      })
      .returning({ id: salesOrders.id });
    return { salesOrderId: row!.id, number };
  }

  async nextNumber(prefix: "Q" | "SO" | "INV" | "SUB"): Promise<string> {
    const table =
      prefix === "Q" ? quotes : prefix === "SO" ? salesOrders : prefix === "INV" ? invoices : submittalPackages;
    const col =
      prefix === "SUB"
        ? (submittalPackages.submittalNumber as unknown as typeof quotes.number)
        : (table as typeof quotes).number;
    const rows = await db
      .select({ number: col })
      .from(table as typeof quotes)
      .where(like(col, `${prefix}-%`))
      .orderBy(desc(col))
      .limit(200);
    let max = NUMBER_STARTS[prefix]! - 1;
    for (const r of rows) {
      const n = parseInt(String(r.number ?? "").replace(`${prefix}-`, ""), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `${prefix}-${max + 1}`;
  }
}
