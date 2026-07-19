/**
 * Day routes (WO-12) — deterministic geography as a feature: route order and
 * leave-by times come from the MapsProvider + arithmetic, not model text. No
 * LLM anywhere in this module. Computed at most once per demo-day per variant
 * and cached in routes_cache; recompute is explicit and audit-logged.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { accounts, routesCache } from "@/db/schema";
import { audit, type AuditActor } from "@/lib/audit";
import { dayBounds, formatTimeShort, repDateKey } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { REP } from "@/lib/rep";
import { getCalendarProvider, getMapsProvider } from "@/providers";
import type { MapsProvider } from "@/providers/maps/types";

export const BUFFER_MIN = 15;

/** Shared output contract — demo and live provider results both parse this. */
export const OptimizedRouteSchema = z.object({
  orderedStopIds: z.array(z.string()),
  legs: z.array(
    z.object({ fromId: z.string(), toId: z.string(), durationSec: z.number(), distanceMeters: z.number() }),
  ),
  totalDurationSec: z.number(),
  totalDistanceMeters: z.number(),
  shareUrl: z.string(),
  computedAt: z.string(),
  linkTruncatedStopIds: z.array(z.string()),
});
export type OptimizedRoutePayload = z.infer<typeof OptimizedRouteSchema>;

export type LeaveBy = {
  leaveBy: string; // ISO
  tight: boolean;
  /** Wrap-up deadline when the NEXT stop's leave-by lands inside this meeting. */
  departBy: string | null;
  inputs: { meetingStart: string; legDurationSec: number; bufferMin: number; fromLabel: string };
  tooltip: string;
};

export type DayRouteStop = {
  id: string;
  title: string;
  accountName: string | null;
  location: string | null;
  lat: number;
  lng: number;
  startsAt: string; // ISO
  endsAt: string; // ISO
  prepNotes: string | null;
};

export type DayRoute = {
  routeDate: string;
  variant: string;
  roundTrip: boolean;
  excludedStopIds: string[];
  origin: { label: string; lat: number; lng: number };
  /** In optimized order. */
  stops: DayRouteStop[];
  route: OptimizedRoutePayload;
  leaveBys: Record<string, LeaveBy>;
  /** Today's meetings without geo — listed on the page, never routed. */
  unroutable: { id: string; title: string }[];
};

// ── Pure leave-by math (task 2) ──────────────────────────────────────────────

export type LeaveByComputation = {
  leaveBy: Date;
  tight: boolean;
  departBy: Date | null;
  legDurationSec: number;
  fromLabel: string;
};

/**
 * leaveBy = meetingStart − legDuration(previous→stop) − buffer. Walks
 * backwards from the last timed meeting: a stop is "tight" when its leave-by
 * lands before the previous meeting ends, and that previous stop gets a
 * `departBy` (wrap-up deadline) so earlier chips surface the downstream
 * commitment.
 */
export function computeLeaveBys(opts: {
  orderedStops: { id: string; label: string; startsAt: Date; endsAt: Date }[];
  legs: { fromId: string; toId: string; durationSec: number }[];
  originLabel: string;
  bufferMin?: number;
}): Map<string, LeaveByComputation> {
  const bufferMin = opts.bufferMin ?? BUFFER_MIN;
  const legTo = new Map(opts.legs.map((l) => [l.toId, l]));
  const out = new Map<string, LeaveByComputation>();

  let downstreamLeaveBy: Date | null = null;
  for (let i = opts.orderedStops.length - 1; i >= 0; i--) {
    const stop = opts.orderedStops[i]!;
    const prev = opts.orderedStops[i - 1];
    const leg = legTo.get(stop.id);
    if (!leg) {
      downstreamLeaveBy = null;
      continue;
    }
    const leaveBy = new Date(stop.startsAt.getTime() - leg.durationSec * 1000 - bufferMin * 60_000);
    out.set(stop.id, {
      leaveBy,
      tight: prev ? leaveBy.getTime() < prev.endsAt.getTime() : false,
      departBy: downstreamLeaveBy && downstreamLeaveBy.getTime() < stop.endsAt.getTime() ? downstreamLeaveBy : null,
      legDurationSec: leg.durationSec,
      fromLabel: prev ? prev.label : opts.originLabel,
    });
    downstreamLeaveBy = leaveBy;
  }
  return out;
}

// ── Variants + cache (task 4) ────────────────────────────────────────────────

export type RouteVariantOpts = { roundTrip?: boolean; excludeStopIds?: string[] };

export function variantKey(opts: RouteVariantOpts): string {
  const excluded = [...(opts.excludeStopIds ?? [])].sort();
  if (!opts.roundTrip && excluded.length === 0) return "default";
  return `${opts.roundTrip ? "rt" : "ow"}${excluded.length > 0 ? `:ex=${excluded.join(",")}` : ""}`;
}

/**
 * Compute once per demo-day per variant on first request; every later call is
 * a cache read (never a provider hit per page render). `forceRecompute`
 * refreshes the row and audit-logs. Returns null when nothing is routable.
 */
export async function getOrComputeTodayRoute(
  opts: RouteVariantOpts & { forceRecompute?: boolean; actor?: AuditActor } = {},
  providerOverride?: MapsProvider,
): Promise<DayRoute | null> {
  const demoNow = await getDemoNow();
  const routeDate = repDateKey(demoNow);
  const variant = variantKey(opts);

  if (!opts.forceRecompute) {
    const cached = await db.query.routesCache.findFirst({
      where: and(eq(routesCache.routeDate, routeDate), eq(routesCache.variant, variant)),
    });
    if (cached) return cached.payload as unknown as DayRoute;
  }

  // Today's docket through the CalendarProvider — never the meetings table.
  const { start, end } = dayBounds(demoNow);
  const events = await getCalendarProvider().listEvents({ start, end });
  const excluded = new Set(opts.excludeStopIds ?? []);
  const active = events.filter((e) => e.status !== "cancelled");
  const routable = active.filter((e) => e.lat != null && e.lng != null && !excluded.has(e.id));
  const unroutable = active.filter((e) => e.lat == null || e.lng == null).map((e) => ({ id: e.id, title: e.title }));
  if (routable.length === 0) return null;

  const provider = providerOverride ?? getMapsProvider();
  const firstStart = Math.min(...routable.map((e) => e.startsAt.getTime()));
  const route = await provider.optimizeRoute({
    origin: REP.homeBase,
    stops: routable.map((e) => ({ id: e.id, label: e.title, lat: e.lat!, lng: e.lng!, arriveBy: e.startsAt })),
    // Deterministic per day: morning departure ahead of the first meeting.
    departAfter: new Date(firstStart - 2 * 3_600_000),
    roundTrip: opts.roundTrip ?? false,
  });

  const byId = new Map(routable.map((e) => [e.id, e]));
  const ordered = route.orderedStopIds.map((id) => byId.get(id)).filter((e) => e !== undefined);

  const accountIds = [...new Set(ordered.map((e) => e.accountId).filter((v): v is string => v != null))];
  const accountRows =
    accountIds.length > 0
      ? await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIds))
      : [];
  const accountName = new Map(accountRows.map((a) => [a.id, a.name]));

  const computations = computeLeaveBys({
    orderedStops: ordered.map((e) => ({ id: e.id, label: e.title, startsAt: e.startsAt, endsAt: e.endsAt })),
    legs: route.legs,
    originLabel: REP.homeBase.label,
  });

  const leaveBys: Record<string, LeaveBy> = {};
  for (const stop of ordered) {
    const c = computations.get(stop.id);
    if (!c) continue;
    leaveBys[stop.id] = {
      leaveBy: c.leaveBy.toISOString(),
      tight: c.tight,
      departBy: c.departBy?.toISOString() ?? null,
      inputs: {
        meetingStart: stop.startsAt.toISOString(),
        legDurationSec: c.legDurationSec,
        bufferMin: BUFFER_MIN,
        fromLabel: c.fromLabel,
      },
      tooltip:
        `${formatTimeShort(stop.startsAt)} start − ${formatDriveDuration(c.legDurationSec)} drive from ` +
        `${c.fromLabel} − ${BUFFER_MIN} min buffer → leave by ${formatTimeShort(c.leaveBy)}` +
        (c.tight ? ` (before the previous meeting ends)` : ""),
    };
  }

  const payload: DayRoute = {
    routeDate,
    variant,
    roundTrip: opts.roundTrip ?? false,
    excludedStopIds: [...excluded].sort(),
    origin: REP.homeBase,
    stops: ordered.map((e) => ({
      id: e.id,
      title: e.title,
      accountName: e.accountId ? (accountName.get(e.accountId) ?? null) : null,
      location: e.location,
      lat: e.lat!,
      lng: e.lng!,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      prepNotes: e.prepNotes,
    })),
    route: OptimizedRouteSchema.parse(route),
    leaveBys,
    unroutable,
  };

  const [row] = await db
    .insert(routesCache)
    .values({ routeDate, variant, payload: payload as unknown as Record<string, unknown>, computedAt: demoNow })
    .onConflictDoUpdate({
      target: [routesCache.routeDate, routesCache.variant],
      set: { payload: payload as unknown as Record<string, unknown>, computedAt: demoNow },
    })
    .returning({ id: routesCache.id });

  if (opts.forceRecompute) {
    await audit({
      actor: opts.actor ?? "system",
      action: "route.recomputed",
      objectType: "route",
      objectId: row!.id,
      detail: { routeDate, variant, stops: payload.stops.length, totalDurationSec: route.totalDurationSec },
    });
  }

  return payload;
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function formatDriveDuration(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

export function formatMiles(meters: number): string {
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}
