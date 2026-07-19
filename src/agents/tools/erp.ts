/**
 * Shared ERP read tools (WO-05 task 2 & 8) — one module, two consumers: the
 * `quote` agent and WO-04's `email-reply` stock-check path. All effect:'read',
 * all evidence-bearing where the evidence taxonomy allows (inventory_row,
 * price_row). SKU resolution never auto-picks below threshold — it returns
 * candidates so the agent escalates instead of guessing.
 */
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { scopedTool } from "@/harness/tool";
import { getErpProvider } from "@/providers";
import { priceLines, type QuoteLineRequest } from "@/lib/pricing";

export type ProductLite = { id: string; sku: string; name: string };
export type ResolveResult = { query: string; resolved: string | null; candidates: { productId: string; sku: string; name: string; score: number }[] };

const AUTO_RESOLVE_THRESHOLD = 0.8;

const normalizeSku = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Pure scorer: how well `query` matches `product` (0..1). */
export function scoreProduct(query: string, product: ProductLite): number {
  const q = query.trim();
  if (!q) return 0;
  if (product.sku.toUpperCase() === q.toUpperCase()) return 1;
  if (normalizeSku(product.sku) === normalizeSku(q)) return 0.95;
  const name = product.name.toLowerCase();
  const ql = q.toLowerCase();
  if (name === ql) return 0.9;
  if (name.includes(ql) || ql.includes(name)) return 0.72;
  const qTokens = new Set(ql.split(/\s+/).filter(Boolean));
  const nTokens = name.split(/\s+/).filter(Boolean);
  if (qTokens.size === 0 || nTokens.length === 0) return 0;
  const overlap = nTokens.filter((t) => qTokens.has(t)).length;
  return overlap / Math.max(qTokens.size, nTokens.length) * 0.7;
}

/** Pure resolution over a product list (unit-testable without a DB). */
export function resolveQuery(query: string, catalog: ProductLite[]): ResolveResult {
  const scored = catalog
    .map((p) => ({ productId: p.id, sku: p.sku, name: p.name, score: scoreProduct(query, p) }))
    .filter((c) => c.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const top = scored[0];
  const resolved = top && top.score >= AUTO_RESOLVE_THRESHOLD ? top.productId : null;
  return { query, resolved, candidates: scored };
}

export async function resolveProducts(queries: string[]): Promise<ResolveResult[]> {
  const catalog = await db.select({ id: products.id, sku: products.sku, name: products.name }).from(products);
  return queries.map((q) => resolveQuery(q, catalog));
}

export const lookupProducts = scopedTool<{ queries: string[] }>({
  name: "lookup_products",
  description: "Resolve SKU/name queries to products (exact → normalized → fuzzy). Returns candidates when below the confidence threshold.",
  effect: "read",
  inputSchema: z.object({ queries: z.array(z.string()) }),
  execute: async ({ queries }) => ({ data: { results: await resolveProducts(queries) } }),
});

export const checkStock = scopedTool<{ productIds?: string[]; skus?: string[] }>({
  name: "check_stock",
  description: "On-hand / allocated / available / lead time per product via ErpProvider. Emits inventory_row evidence.",
  effect: "read",
  inputSchema: z.object({ productIds: z.array(z.string()).optional(), skus: z.array(z.string()).optional() }),
  execute: async ({ productIds, skus }) => {
    let ids = productIds ?? [];
    if (skus?.length) {
      const rows = await db.select({ id: products.id }).from(products).where(inArray(products.sku, skus));
      ids = [...ids, ...rows.map((r) => r.id)];
    }
    ids = [...new Set(ids)];
    if (ids.length === 0) return { data: { rows: [] } };
    const [stock, nameRows] = await Promise.all([
      getErpProvider().checkStock(ids),
      db.select({ id: products.id, sku: products.sku, name: products.name }).from(products).where(inArray(products.id, ids)),
    ]);
    const meta = new Map(nameRows.map((r) => [r.id, r]));
    const rows = stock.map((s) => ({
      productId: s.productId,
      sku: meta.get(s.productId)?.sku ?? s.sku,
      name: meta.get(s.productId)?.name ?? "",
      onHand: s.onHand,
      allocated: s.allocated,
      available: s.available,
      leadTimeDays: s.leadTimeDays,
    }));
    return {
      data: { rows },
      evidence: rows.map((r) => ({ type: "inventory_row" as const, ref: { sku: r.sku }, quote: `${r.sku}: ${r.available > 0 ? `${r.available} available` : "low"}, ${r.leadTimeDays}d` })),
    };
  },
});

export const getPricing = scopedTool<{ accountId: string; lines: QuoteLineRequest[] }>({
  name: "get_pricing",
  description: "Account-tier pricing from price-list rows (deterministic). Emits price_row evidence. Escalates on a missing row.",
  effect: "read",
  inputSchema: z.object({
    accountId: z.string(),
    lines: z.array(z.object({ productId: z.string(), qty: z.number(), uom: z.string().optional() })),
  }),
  execute: async ({ accountId, lines }) => {
    const priced = await priceLines(accountId, lines);
    return {
      data: priced,
      evidence: priced.lines.map((l) => ({ type: "price_row" as const, ref: { priceListItemId: l.priceListItemId }, quote: `${priced.tier} unit ${(l.unitPriceCents / 100).toFixed(2)}` })),
    };
  },
});
