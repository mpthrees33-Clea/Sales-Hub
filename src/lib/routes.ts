/**
 * Day-route computation, caching, and leave-by math (WO-12). Deliberately
 * LLM-free — route order and times come from the MapsProvider (Routes API or
 * the deterministic demo provider) and arithmetic. The provider is called at
 * most once per demo-day per config; results land in `routes_cache`.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetings, routesCache, type RouteCachePayload, type RouteCacheStop } from "@/db/schema";
import { audit } from "@/lib/audit";
import { dayBounds, repDateKey } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { REP } from "@/lib/rep";
import { getMapsProvider } from "@/providers";
import type { RouteStop } from "@/providers/maps/types";

export const DEFAULT_BUFFER_MIN = 15;

export type RouteConfig = { roundTrip: boolean; excludeIds: string[] };

/** Stable cache key for a config (order-independent on exclusions). */
export function variantKey(cfg: RouteConfig): string {
  const excl = [...cfg.excludeIds].sort().join(",");
  return `rt:${cfg.roundTrip ? 1 : 0}|excl:${excl}`;
}

// ── Leave-by math (pure, tested) ─────────────────────────────────────────────

export type LeaveByChip = {
  stopId: string;
  leaveBy: Date | null; // null when the stop has no arriveBy (untimed)
  legDurationSec: number;
  bufferMin: number;
  arriveBy: Date | null;
  tight: boolean;
  /** Human-readable inputs for the tooltip. */
  inputs: string;
};

/**
 * Leave-by per ordered stop = arriveBy − incoming leg − buffer. Walk BACKWARD
 * from the last timed stop so an earlier stop is flagged "tight" when its
 * leave-by falls before the previous meeting ends (you cannot be two places at
 * once) OR before the leave-by of the downstream commitment.
 */
export function computeLeaveBy(
  orderedStops: { id: string; arriveBy: Date | null; endsAt: Date | null }[],
  legs: { fromId: string; toId: string; durationSec: number }[],
  bufferMin = DEFAULT_BUFFER_MIN,
): LeaveByChip[] {
  const legTo = new Map(legs.map((l) => [l.toId, l]));
  const bufferSec = bufferMin * 60;

  const chips: LeaveByChip[] = orderedStops.map((s) => {
    const leg = legTo.get(s.id);
    const legDurationSec = leg?.durationSec ?? 0;
    const leaveBy = s.arriveBy ? new Date(s.arriveBy.getTime() - legDurationSec * 1000 - bufferSec * 1000) : null;
    return {
      stopId: s.id,
      leaveBy,
      legDurationSec,
      bufferMin,
      arriveBy: s.arriveBy,
      tight: false,
      inputs: s.arriveBy
        ? `${fmt(s.arriveBy)} arrive − ${Math.round(legDurationSec / 60)}m drive − ${bufferMin}m buffer`
        : "no fixed arrival",
    };
  });

  // Backward walk: a stop is tight if you must leave before the PREVIOUS stop's
  // meeting ends, or before the next stop's leave-by (downstream constraint).
  for (let i = chips.length - 1; i >= 0; i--) {
    const chip = chips[i]!;
    if (!chip.leaveBy) continue;
    const prev = i > 0 ? orderedStops[i - 1] : null;
    const downstream = i < chips.length - 1 ? chips[i + 1] : null;
    const conflictsPrev = prev?.endsAt ? chip.leaveBy < prev.endsAt : false;
    const conflictsDownstream = downstream?.leaveBy ? downstream.leaveBy < chip.leaveBy : false;
    chip.tight = conflictsPrev || conflictsDownstream;
  }
  return chips;
}

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: REP.tz }).format(d);
}

// ── Compute + cache ──────────────────────────────────────────────────────────

/** Today's meetings with coordinates, in chronological order (route stops). */
async function todaysStops(now: Date): Promise<RouteCacheStop[]> {
  const { start, end } = dayBounds(now);
  const rows = await db.select().from(meetings).orderBy(meetings.startsAt);
  return rows
    .filter((m) => m.startsAt >= start && m.startsAt <= end && m.lat != null && m.lng != null)
    .map((m) => ({
      id: m.id,
      title: m.title,
      location: m.location,
      lat: m.lat!,
      lng: m.lng!,
      arriveBy: m.startsAt.toISOString(),
      endsAt: m.endsAt.toISOString(),
      prepNote: m.prepNotes ?? undefined,
    }));
}

/** All of today's geo-located meeting stops (for the include/exclude toggle UI). */
export async function listTodayStops(): Promise<{ id: string; title: string }[]> {
  const now = await getDemoNow();
  return (await todaysStops(now)).map((s) => ({ id: s.id, title: s.title }));
}

async function computeRoute(cfg: RouteConfig, now: Date): Promise<RouteCachePayload> {
  const allStops = await todaysStops(now);
  const stops = allStops.filter((s) => !cfg.excludeIds.includes(s.id));
  const provider = getMapsProvider();
  const providerStops: RouteStop[] = stops.map((s) => ({ id: s.id, label: s.title, lat: s.lat, lng: s.lng, arriveBy: s.arriveBy ? new Date(s.arriveBy) : undefined }));
  const route = await provider.optimizeRoute({
    origin: { label: REP.homeBase.label, lat: REP.homeBase.lat, lng: REP.homeBase.lng },
    stops: providerStops,
    departAfter: now,
    roundTrip: cfg.roundTrip,
  });
  return {
    origin: { label: REP.homeBase.label, lat: REP.homeBase.lat, lng: REP.homeBase.lng },
    roundTrip: cfg.roundTrip,
    departAfter: now.toISOString(),
    stops,
    route,
  };
}

/** Cached route for today+config, computing (and caching) once if absent. */
export async function getOrComputeTodayRoute(cfg: RouteConfig = { roundTrip: false, excludeIds: [] }): Promise<RouteCachePayload> {
  const now = await getDemoNow();
  const day = repDateKey(now);
  const variant = variantKey(cfg);
  const existing = await db
    .select()
    .from(routesCache)
    .where(and(eq(routesCache.routeDate, day), eq(routesCache.variant, variant)))
    .limit(1);
  if (existing[0]) return existing[0].payload;

  const payload = await computeRoute(cfg, now);
  await db
    .insert(routesCache)
    .values({ routeDate: day, variant, payload })
    .onConflictDoNothing({ target: [routesCache.routeDate, routesCache.variant] });
  return payload;
}

/** Force a fresh computation (recompute button), replacing the cache + audit. */
export async function recomputeTodayRoute(cfg: RouteConfig, userId: string): Promise<RouteCachePayload> {
  const now = await getDemoNow();
  const day = repDateKey(now);
  const variant = variantKey(cfg);
  const payload = await computeRoute(cfg, now);
  await db
    .insert(routesCache)
    .values({ routeDate: day, variant, payload })
    .onConflictDoUpdate({ target: [routesCache.routeDate, routesCache.variant], set: { payload, computedAt: now } });
  await audit({ actor: `user:${userId}`, action: "route.recomputed", objectType: "routes_cache", detail: { day, variant, stops: payload.stops.length } });
  return payload;
}

/** Ordered stops + their leave-by chips for a cached payload. */
export function orderedWithLeaveBy(payload: RouteCachePayload, bufferMin = DEFAULT_BUFFER_MIN): { stop: RouteCacheStop; chip: LeaveByChip }[] {
  const byId = new Map(payload.stops.map((s) => [s.id, s]));
  const ordered = payload.route.orderedStopIds.map((id) => byId.get(id)).filter((s): s is RouteCacheStop => Boolean(s));
  const chips = computeLeaveBy(
    ordered.map((s) => ({ id: s.id, arriveBy: s.arriveBy ? new Date(s.arriveBy) : null, endsAt: s.endsAt ? new Date(s.endsAt) : null })),
    payload.route.legs,
    bufferMin,
  );
  const chipById = new Map(chips.map((c) => [c.stopId, c]));
  return ordered.map((stop) => ({ stop, chip: chipById.get(stop.id)! }));
}
