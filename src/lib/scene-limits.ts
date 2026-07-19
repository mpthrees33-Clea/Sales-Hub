/**
 * Scene generation caps + cost visibility (WO-11 task 3, docs/02 §4 LLM10).
 * Image generation is user-triggered only, capped per demo-day, and every
 * generation writes an audit row. Config lives here, not env.
 */
import { and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { roomScenes } from "@/db/schema";
import { dayBounds } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";

export const SCENE_CONFIG = {
  /** Max generations per demo-day (fixture or live). */
  perDayCap: 10,
  /** Shown before generating — honest ballpark for the live image model. */
  estimatedCostUsd: 0.15,
} as const;

export async function sceneBudget(): Promise<{
  usedToday: number;
  cap: number;
  remaining: number;
  estimatedCostUsd: number;
}> {
  const demoNow = await getDemoNow();
  const { start, end } = dayBounds(demoNow);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(roomScenes)
    .where(and(gte(roomScenes.createdAt, start), lte(roomScenes.createdAt, end)));
  const usedToday = row?.n ?? 0;
  return {
    usedToday,
    cap: SCENE_CONFIG.perDayCap,
    remaining: Math.max(0, SCENE_CONFIG.perDayCap - usedToday),
    estimatedCostUsd: SCENE_CONFIG.estimatedCostUsd,
  };
}
