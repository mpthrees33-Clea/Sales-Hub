/**
 * ErpProvider — stock / pricing / order queries. Always the seeded Postgres:
 * there is no live ERP (docs/01 §6); the seeded schema deliberately mirrors
 * the CSV→QuickBooks→NetSuite integration ladder (docs/APPENDIX §4.3).
 */
import type { SalesOrderLine } from "@/db/schema";

export type StockRow = {
  productId: string;
  sku: string;
  onHand: number;
  allocated: number;
  available: number;
  leadTimeDays: number;
  restockAt: Date | null;
  inventoryRowId: string;
};

export type PriceRow = {
  productId: string;
  sku: string;
  unitPriceCents: number;
  minQty: number;
  priceListItemId: string;
  priceListId: string;
  priceListName: string;
  tier: "list" | "distributor" | "project";
};

export interface ErpProvider {
  checkStock(productIds: string[]): Promise<StockRow[]>;
  resolvePriceList(accountId: string): Promise<{ priceListId: string; name: string; tier: string }>;
  /** Tier price rows for an account; throws EscalationError on a missing row. */
  getPrices(accountId: string, items: { productId: string; qty: number }[]): Promise<PriceRow[]>;
  createSalesOrder(so: {
    poId?: string;
    accountId: string;
    lines: SalesOrderLine[];
    subtotalCents: number;
    totalCents: number;
  }): Promise<{ salesOrderId: string; number: string }>;
  /** Next sequential document number ("Q-1043", "SO-2091"). */
  nextNumber(prefix: "Q" | "SO" | "INV" | "SUB"): Promise<string>;
}
