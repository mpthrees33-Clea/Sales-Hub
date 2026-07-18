/**
 * Deterministic matching primitives for the PO pipeline (WO-06):
 * SKU normalization + Levenshtein candidates, token-set account matcher,
 * and the duplicate-detection line fingerprint. Pure functions — no model,
 * no randomness, no clock.
 */
import { createHash } from "node:crypto";

export function normalizeSku(s: string): string {
  return s.toUpperCase().replace(/[\s\-.]/g, "");
}

export function levenshtein(a: string, b: string): number {
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

/** Top SKU candidates for an unresolved raw text (Levenshtein ≤2 + name substring). */
export function skuCandidates(
  rawText: string,
  catalog: { productId: string; sku: string; name: string }[],
): { productId: string; sku: string; name: string; score: number }[] {
  const norm = normalizeSku(rawText);
  const lower = rawText.toLowerCase();
  return catalog
    .map((c) => {
      const dist = levenshtein(normalizeSku(c.sku), norm);
      const nameHit = c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase());
      const score = dist <= 2 ? 1 - dist * 0.2 : nameHit ? 0.55 : 0;
      return { productId: c.productId, sku: c.sku, name: c.name, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.sku.localeCompare(b.sku))
    .slice(0, 3);
}

const STOP_TOKENS = new Set(["inc", "llc", "co", "corp", "company", "the", "warehouse", "of", "and"]);

export function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_TOKENS.has(t)),
  );
}

/** Normalized token-set similarity (0..1) for company/address matching. */
export function tokenSetSimilarity(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

/** Duplicate-detection fingerprint: sha256 of sorted [product_id, qty, unit_price_cents]. */
export function lineFingerprint(lines: { product_id: string; qty: number; unit_price_cents: number }[]): string {
  const sorted = [...lines]
    .map((l) => [l.product_id, l.qty, l.unit_price_cents] as const)
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1] || a[2] - b[2]);
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}
