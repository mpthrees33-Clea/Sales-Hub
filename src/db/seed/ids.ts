/**
 * Deterministic ids: every seeded row's uuid derives from a stable name, so
 * `pnpm seed` twice yields identical ids (WO-01 acceptance) and fixtures can
 * reference rows by name at authoring time.
 */
import { createHash } from "node:crypto";

export function sid(name: string): string {
  const hex = createHash("sha256").update(`clea-sales-hub:${name}`).digest("hex");
  // uuid-v4 shape (version/variant nibbles fixed) from the hash
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "8" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Deterministic integer in [0, n) from a name — for jitter, quantities, etc. */
export function shash(name: string, n: number): number {
  const hex = createHash("sha256").update(`clea-hash:${name}`).digest("hex");
  return parseInt(hex.slice(0, 8), 16) % n;
}
