/**
 * WO-05 deterministic pricing: exact price-list match + integer totals,
 * per-row minimum-order-qty enforcement (requestedQty preserved), the
 * invalid-qty guard, and missing-row escalation (never a guessed price).
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, priceListItems, products } from "@/db/schema";
import { priceLines, resolvePriceList } from "@/lib/pricing";
import { EscalationError } from "@/harness/errors";

beforeAll(async () => {
  // The canonical scenario is already seeded by earlier suites / global setup;
  // pricing reads it read-only.
  const [any] = await db.select({ id: accounts.id }).from(accounts).limit(1);
  if (!any) throw new Error("no accounts seeded — run `pnpm seed` first");
});

describe("priceLines (deterministic math)", () => {
  it("prices a line at the exact price-list row and computes integer totals", async () => {
    const [acct] = await db.select({ id: accounts.id }).from(accounts).limit(1);
    const [prod] = await db.select({ id: products.id }).from(products).limit(1);
    const pl = await resolvePriceList(acct!.id);
    const [row] = await db
      .select({ unitPriceCents: priceListItems.unitPriceCents, minQty: priceListItems.minQty })
      .from(priceListItems)
      .where(and(eq(priceListItems.priceListId, pl.priceListId), eq(priceListItems.productId, prod!.id)))
      .limit(1);
    if (!row) return; // product not on the resolved list

    const priced = await priceLines(acct!.id, [{ productId: prod!.id, qty: Math.max(3, row.minQty), uom: "roll" }]);
    expect(priced.lines[0]!.unitPriceCents).toBe(row.unitPriceCents);
    expect(priced.lines[0]!.extendedCents).toBe(row.unitPriceCents * priced.lines[0]!.qty);
    expect(Number.isInteger(priced.subtotalCents)).toBe(true);
    expect(["list", "distributor", "project"]).toContain(priced.lines[0]!.tier);
  });

  it("enforces the per-row minimum order quantity while preserving requestedQty", async () => {
    const [acct] = await db.select({ id: accounts.id }).from(accounts).limit(1);
    const pl = await resolvePriceList(acct!.id);
    const [row] = await db
      .select({ productId: priceListItems.productId, minQty: priceListItems.minQty })
      .from(priceListItems)
      .where(and(eq(priceListItems.priceListId, pl.priceListId), gt(priceListItems.minQty, 1)))
      .limit(1);
    if (!row) return; // no min-qty>1 rows seeded → nothing to assert
    const priced = await priceLines(acct!.id, [{ productId: row.productId, qty: 1 }]);
    expect(priced.lines[0]!.qty).toBe(row.minQty);
    expect(priced.lines[0]!.requestedQty).toBe(1);
    expect(priced.lines[0]!.extendedCents).toBe(priced.lines[0]!.unitPriceCents * row.minQty);
  });

  it("escalates a non-positive / non-integer qty (invalid_qty guard)", async () => {
    const [acct] = await db.select({ id: accounts.id }).from(accounts).limit(1);
    const [prod] = await db.select({ id: products.id }).from(products).limit(1);
    await expect(priceLines(acct!.id, [{ productId: prod!.id, qty: 0 }])).rejects.toBeInstanceOf(EscalationError);
    await expect(priceLines(acct!.id, [{ productId: prod!.id, qty: 2.5 }])).rejects.toBeInstanceOf(EscalationError);
  });

  it("escalates on a missing price-list row (never a guessed price)", async () => {
    const [acct] = await db.select({ id: accounts.id }).from(accounts).limit(1);
    await expect(priceLines(acct!.id, [{ productId: randomUUID(), qty: 5 }])).rejects.toBeInstanceOf(EscalationError);
  });
});
