/**
 * Pure matching helpers for PO validation (WO-06) — SKU normalization +
 * Levenshtein nearest-match, token-set account/address similarity, and the
 * line fingerprint used for duplicate detection. No LLM, no DB, no wall clock:
 * same input ⇒ same output.
 */
import { createHash } from "node:crypto";

export function normalizeSku(s: string): string {
  return s.toUpperCase().replace(/[\s.\-_]/g, "");
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

export type SkuCandidate = { productId: string; sku: string; name: string; distance: number };

/** Top-k nearest SKUs by normalized Levenshtein (≤2) plus name-substring hits. */
export function nearestSkus(rawSku: string, catalog: { id: string; sku: string; name: string }[], k = 3): SkuCandidate[] {
  const target = normalizeSku(rawSku);
  const lower = rawSku.toLowerCase();
  return catalog
    .map((p) => {
      const dist = levenshtein(target, normalizeSku(p.sku));
      const nameHit = p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase());
      return { productId: p.id, sku: p.sku, name: p.name, distance: nameHit ? Math.min(dist, 2) : dist };
    })
    .filter((c) => c.distance <= 2)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
}

const STOP = new Set(["the", "co", "inc", "llc", "ltd", "company", "corp", "and", "&", "of", "group"]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** Token-set similarity (Jaccard over significant tokens), 0..1. */
export function tokenSetSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type FingerprintLine = { productId: string; qty: number; unitPriceCents: number };

/** Order-independent fingerprint of resolved lines for duplicate detection. */
export function lineFingerprint(lines: FingerprintLine[]): string {
  const norm = lines
    .map((l) => `${l.productId}:${l.qty}:${l.unitPriceCents}`)
    .sort()
    .join("|");
  return createHash("sha256").update(norm).digest("hex").slice(0, 32);
}
