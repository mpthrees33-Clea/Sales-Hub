/**
 * WO-05: deterministic pricing (tier selection, min-qty enforcement, exact
 * price-list match, missing-row escalation) and SKU resolution (exact →
 * normalized → fuzzy → none).
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, priceListItems, products } from "@/db/schema";
import { priceLines, resolvePriceList } from "@/lib/pricing";
import { EscalationError } from "@/harness/errors";
import { resolveQuery, type ProductLite } from "@/agents/tools/erp";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

describe("priceLines (deterministic math)", () => {
  it("prices a line at the exact price-list row and computes integer totals", async () => {
    const [acct] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.type, "distributor")).limit(1);
    const [prod] = await db.select({ id: products.id }).from(products).limit(1);
    const pl = await resolvePriceList(acct!.id);
    const [row] = await db
      .select({ unitPriceCents: priceListItems.unitPriceCents, minQty: priceListItems.minQty })
      .from(priceListItems)
      .where(and(eq(priceListItems.priceListId, pl.priceListId), eq(priceListItems.productId, prod!.id)))
      .limit(1);

    const priced = await priceLines(acct!.id, [{ productId: prod!.id, qty: Math.max(3, row!.minQty), uom: "roll" }]);
    expect(priced.lines[0]!.unitPriceCents).toBe(row!.unitPriceCents);
    expect(priced.lines[0]!.extendedCents).toBe(row!.unitPriceCents * priced.lines[0]!.qty);
    expect(Number.isInteger(priced.subtotalCents)).toBe(true);
    expect(["list", "distributor", "project"]).toContain(priced.tier);
  });

  it("enforces the per-row minimum order quantity", async () => {
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
  });

  it("escalates on a missing price-list row (never a guessed price)", async () => {
    const [acct] = await db.select({ id: accounts.id }).from(accounts).limit(1);
    await expect(priceLines(acct!.id, [{ productId: randomUUID(), qty: 5 }])).rejects.toBeInstanceOf(EscalationError);
  });
});

describe("resolveQuery (SKU resolution)", () => {
  const catalog: ProductLite[] = [
    { id: "p1", sku: "MS-WG-1147", name: "Walnut Grain" },
    { id: "p2", sku: "MS-WO-2210", name: "White Oak" },
  ];
  it("resolves an exact SKU", () => {
    expect(resolveQuery("MS-WG-1147", catalog).resolved).toBe("p1");
  });
  it("resolves a normalized SKU (spaces/case)", () => {
    expect(resolveQuery("ms wg 1147", catalog).resolved).toBe("p1");
  });
  it("resolves an exact name", () => {
    expect(resolveQuery("Walnut Grain", catalog).resolved).toBe("p1");
  });
  it("returns candidates (not a pick) for a fuzzy partial", () => {
    const r = resolveQuery("Walnut", catalog);
    expect(r.resolved).toBeNull();
    expect(r.candidates.map((c) => c.productId)).toContain("p1");
  });
  it("resolves nothing for nonsense", () => {
    expect(resolveQuery("Zorblax 9000", catalog).resolved).toBeNull();
  });
});
