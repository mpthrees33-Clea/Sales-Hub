/**
 * Shared ERP read tools (WO-05 task 2) — one module, multiple consumers:
 * the quote agent, email-reply stock-check enrichment, and the meeting
 * follow-up agent. All `effect:'read'`, all evidence-bearing.
 */
import { ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { scopedTool } from "@/harness/tool";
import { priceLines } from "@/lib/pricing";
import { getErpProvider } from "@/providers";

function normalizeSku(s: string): string {
  return s.toUpperCase().replace(/[\s\-.]/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)] as number[]);
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m]![n]!;
}

/**
 * Fuzzy SKU/name resolution: exact SKU → normalized SKU → name match.
 * Never auto-picks below confidence — returns candidates instead.
 */
export const lookupProducts = scopedTool({
  name: "lookup_products",
  description:
    "Resolve product mentions (SKU codes or names) to catalog products. Returns resolved id per query or candidate list when ambiguous — never guesses.",
  effect: "read",
  inputSchema: z.object({ queries: z.array(z.string().min(1)).min(1) }),
  execute: async (input) => {
    const catalog = await db
      .select({ id: products.id, sku: products.sku, name: products.name, finish: products.finish })
      .from(products);
    const results = input.queries.map((q) => {
      const trimmed = q.trim();
      const exact = catalog.find((c) => c.sku === trimmed.toUpperCase());
      if (exact) return { query: q, resolved: exact.id, sku: exact.sku, name: exact.name, method: "exact" as const };
      const norm = normalizeSku(trimmed);
      const normalized = catalog.find((c) => normalizeSku(c.sku) === norm);
      if (normalized) {
        return { query: q, resolved: normalized.id, sku: normalized.sku, name: normalized.name, method: "normalized" as const };
      }
      const nameExact = catalog.filter((c) => c.name.toLowerCase() === trimmed.toLowerCase());
      if (nameExact.length === 1) {
        const c = nameExact[0]!;
        return { query: q, resolved: c.id, sku: c.sku, name: c.name, method: "name" as const };
      }
      const scored = catalog
        .map((c) => ({
          productId: c.id,
          sku: c.sku,
          name: c.name,
          score: Math.max(
            c.name.toLowerCase().includes(trimmed.toLowerCase()) ? 0.8 : 0,
            levenshtein(normalizeSku(c.sku), norm) <= 2 ? 0.7 : 0,
          ),
        }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      if (scored.length === 1 && scored[0]!.score >= 0.8) {
        const c = scored[0]!;
        return { query: q, resolved: c.productId, sku: c.sku, name: c.name, method: "fuzzy" as const };
      }
      return { query: q, resolved: null, candidates: scored, method: "unresolved" as const };
    });
    return { data: { results } };
  },
});

export const checkStock = scopedTool({
  name: "check_stock",
  description: "Live stock for product ids: on-hand, allocated, available, lead time. Returns inventory evidence.",
  effect: "read",
  inputSchema: z.object({ productIds: z.array(z.string().uuid()).min(1) }),
  execute: async (input) => {
    const rows = await getErpProvider().checkStock(input.productIds);
    return {
      data: {
        stock: rows.map((r) => ({
          productId: r.productId,
          sku: r.sku,
          onHand: r.onHand,
          allocated: r.allocated,
          available: r.available,
          leadTimeDays: r.leadTimeDays,
        })),
      },
      evidence: rows.map((r) => ({
        type: "inventory_row" as const,
        ref: { sku: r.sku, inventoryRowId: r.inventoryRowId },
        quote: `${r.sku}: ${r.available} available · ${r.leadTimeDays}d lead`,
      })),
    };
  },
});

export const getPricing = scopedTool({
  name: "get_pricing",
  description:
    "Account-tier pricing for lines via the deterministic pricing module. The model must use these values verbatim — it never computes prices. Returns price-row evidence.",
  effect: "read",
  inputSchema: z.object({
    accountId: z.string().uuid(),
    lines: z.array(z.object({ productId: z.string().uuid(), qty: z.number().int().positive() })).min(1),
  }),
  execute: async (input) => {
    const priced = await priceLines(input.accountId, input.lines);
    return {
      data: priced,
      evidence: priced.lines.map((l) => ({
        type: "price_row" as const,
        ref: { priceListItemId: l.priceListItemId },
        quote: `${l.sku} @ $${(l.unitPriceCents / 100).toFixed(2)} (${l.tier})`,
      })),
    };
  },
});

/** Product detail lookup (spec + fire rating) for grounded technical replies. */
export const getProductDetails = scopedTool({
  name: "get_product_details",
  description: "Product spec details (family, finish, fire rating, dimensions) for grounded technical answers.",
  effect: "read",
  inputSchema: z.object({ query: z.string().min(1) }),
  execute: async (input) => {
    const rows = await db
      .select()
      .from(products)
      .where(or(ilike(products.sku, `%${input.query}%`), ilike(products.name, `%${input.query}%`)))
      .limit(3);
    return {
      data: {
        products: rows.map((r) => ({
          productId: r.id,
          sku: r.sku,
          name: r.name,
          family: r.family,
          finish: r.finish,
          spec: r.spec,
        })),
      },
    };
  },
});
