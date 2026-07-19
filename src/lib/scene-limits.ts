/**
 * Room-scene generation caps & cost (WO-11 task 3). Image generation is the
 * only intentionally-live, money-spending call in the system, so it is capped
 * per demo-day and its estimated cost is shown before the user commits. The
 * count is derived from `room_scenes` rows dated on the current demo day
 * (getDemoNow) — no separate counter to drift.
 */
import { and, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { roomScenes } from "@/db/schema";
import { dayBounds } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";

export const SCENE_DAILY_CAP = 10;
/** Rough per-image cost of the live Gemini image model, shown pre-generation. */
export const SCENE_COST_USD = 0.15;

export type SceneQuota = {
  used: number;
  cap: number;
  remaining: number;
  capReached: boolean;
  estimatedCostUsd: number;
};

/** Scenes generated on the demo day containing `now` (defaults to demo clock). */
export async function sceneQuota(now?: Date): Promise<SceneQuota> {
  const at = now ?? (await getDemoNow());
  const { start, end } = dayBounds(at);
  const rows = await db
    .select({ id: roomScenes.id })
    .from(roomScenes)
    .where(and(gte(roomScenes.createdAt, start), lte(roomScenes.createdAt, end)));
  const used = rows.length;
  const remaining = Math.max(0, SCENE_DAILY_CAP - used);
  return { used, cap: SCENE_DAILY_CAP, remaining, capReached: remaining === 0, estimatedCostUsd: SCENE_COST_USD };
}

export class SceneCapError extends Error {
  readonly quota: SceneQuota;
  constructor(quota: SceneQuota) {
    super(`Daily scene generation cap reached (${quota.used}/${quota.cap}). It resets on the next demo day.`);
    this.name = "SceneCapError";
    this.quota = quota;
  }
}

/** Throws SceneCapError if the demo day's cap is already spent. */
export async function assertSceneQuota(now?: Date): Promise<SceneQuota> {
  const q = await sceneQuota(now);
  if (q.capReached) throw new SceneCapError(q);
  return q;
}
