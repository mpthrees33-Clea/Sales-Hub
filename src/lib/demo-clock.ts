/**
 * The demo clock (docs/01-ARCHITECTURE.md §8). Domain logic NEVER calls
 * `new Date()` — it calls getDemoNow(), which reads demo_state.demo_now.
 * Simulate Overnight and jump-clock work because of this single seam.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { demoState } from "@/db/schema";

// Short-TTL cache so a request's many reads don't hammer the singleton row.
let cache: { at: number; value: Date } | null = null;
const TTL_MS = 500;

export async function getDemoNow(): Promise<Date> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await db.query.demoState.findFirst({ where: eq(demoState.id, 1) });
  if (!row) {
    throw new Error("demo_state singleton missing — run `pnpm seed` first");
  }
  cache = { at: Date.now(), value: row.demoNow };
  return row.demoNow;
}

export async function setDemoNow(next: Date): Promise<void> {
  await db
    .insert(demoState)
    .values({ id: 1, demoNow: next })
    .onConflictDoUpdate({ target: demoState.id, set: { demoNow: next, updatedAt: sql`now()` } });
  cache = null;
}

export async function getDemoStateRow() {
  const row = await db.query.demoState.findFirst({ where: eq(demoState.id, 1) });
  if (!row) throw new Error("demo_state singleton missing — run `pnpm seed` first");
  return row;
}

export function invalidateDemoClockCache(): void {
  cache = null;
}
