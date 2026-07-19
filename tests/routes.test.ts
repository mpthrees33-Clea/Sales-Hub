/**
 * WO-12 acceptance: pure leave-by math (incl. the backward-walk tight case),
 * share-URL builder (order, encoding, 9-waypoint truncation, length cap),
 * once-per-day cache (no provider hit on the second call; recompute
 * audit-logs), demo/live shape parity via the shared Zod schema, and the
 * seeded Tuesday: 3 stops in order with exactly one amber "tight" chip.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, routesCache } from "@/db/schema";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import {
  BUFFER_MIN,
  computeLeaveBys,
  getOrComputeTodayRoute,
  OptimizedRouteSchema,
  variantKey,
} from "@/lib/routes";
import { REP } from "@/lib/rep";
import { buildShareUrl } from "@/providers/maps/share-url";
import { DemoMapsProvider } from "@/providers/maps/demo";
import type { MapsProvider, OptimizeRouteInput, OptimizedRoute } from "@/providers/maps/types";
import { sid } from "@/db/seed/ids";
import { DEMO_NOW } from "@/db/seed/scenario";

const STONEBRIDGE = sid("meeting:mtg-stonebridge-tue");
const LUNCH = sid("meeting:mtg-piedmont-lunch");
const ATELIER = sid("meeting:mtg-atelier-pres");

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  await db.execute(sql`delete from routes_cache`);
});

const at = (h: number, m: number) => new Date(Date.UTC(2026, 2, 10, h, m)); // arbitrary fixed day

describe("leave-by math (pure)", () => {
  it("leaveBy = meetingStart − legDuration − buffer, first leg from the origin", () => {
    const out = computeLeaveBys({
      orderedStops: [{ id: "a", label: "Stop A", startsAt: at(10, 0), endsAt: at(11, 0) }],
      legs: [{ fromId: "origin", toId: "a", durationSec: 1200 }],
      originLabel: "HQ",
    });
    const a = out.get("a")!;
    expect(a.leaveBy).toEqual(new Date(at(10, 0).getTime() - 1200 * 1000 - BUFFER_MIN * 60_000));
    expect(a.tight).toBe(false);
    expect(a.fromLabel).toBe("HQ");
  });

  it("backward walk: a leave-by inside the previous meeting flags tight and sets the wrap-by", () => {
    // A 9:00–10:30; B starts 11:00, 45 min drive → leave by 10:00 < 10:30 end.
    const out = computeLeaveBys({
      orderedStops: [
        { id: "a", label: "Stop A", startsAt: at(9, 0), endsAt: at(10, 30) },
        { id: "b", label: "Stop B", startsAt: at(11, 0), endsAt: at(12, 0) },
      ],
      legs: [
        { fromId: "origin", toId: "a", durationSec: 600 },
        { fromId: "a", toId: "b", durationSec: 2700 },
      ],
      originLabel: "HQ",
    });
    const b = out.get("b")!;
    expect(b.leaveBy).toEqual(at(10, 0));
    expect(b.tight).toBe(true);
    expect(b.fromLabel).toBe("Stop A");
    // The earlier stop carries the downstream commitment as a wrap-by deadline.
    expect(out.get("a")!.departBy).toEqual(at(10, 0));
  });

  it("comfortable spacing is neither tight nor wrap-by constrained", () => {
    const out = computeLeaveBys({
      orderedStops: [
        { id: "a", label: "A", startsAt: at(9, 0), endsAt: at(9, 30) },
        { id: "b", label: "B", startsAt: at(11, 0), endsAt: at(12, 0) },
      ],
      legs: [
        { fromId: "origin", toId: "a", durationSec: 600 },
        { fromId: "a", toId: "b", durationSec: 900 },
      ],
      originLabel: "HQ",
    });
    expect(out.get("b")!.tight).toBe(false);
    expect(out.get("a")!.departBy).toBeNull();
  });
});

describe("share-URL builder", () => {
  const p = (i: number) => ({ id: `s${i}`, lat: 35 + i * 0.01, lng: -80 - i * 0.01 });

  it("preserves waypoint order and URL-encodes separators", () => {
    const { url, truncatedStopIds } = buildShareUrl({
      origin: { lat: 35.1847, lng: -80.8891 },
      destination: { lat: 35.7796, lng: -78.6382 },
      waypointsInOrder: [p(1), p(2), p(3)],
    });
    expect(truncatedStopIds).toEqual([]);
    expect(url.startsWith("https://www.google.com/maps/dir/?api=1")).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("travelmode")).toBe("driving");
    // Order preserved after decoding the pipe-separated list.
    const wps = parsed.searchParams.get("waypoints")!.split("|");
    expect(wps).toEqual([`${p(1).lat.toFixed(6)},${p(1).lng.toFixed(6)}`, `${p(2).lat.toFixed(6)},${p(2).lng.toFixed(6)}`, `${p(3).lat.toFixed(6)},${p(3).lng.toFixed(6)}`]);
    // Raw string is encoded: no bare pipes or commas in the query.
    expect(url.includes("|")).toBe(false);
    expect(url).toContain("%7C");
  });

  it("truncates to 9 waypoints and reports the dropped stop ids", () => {
    const { url, truncatedStopIds } = buildShareUrl({
      origin: { lat: 35, lng: -80 },
      destination: { lat: 36, lng: -79 },
      waypointsInOrder: Array.from({ length: 12 }, (_, i) => p(i)),
    });
    expect(truncatedStopIds).toEqual(["s9", "s10", "s11"]);
    expect(new URL(url).searchParams.get("waypoints")!.split("|")).toHaveLength(9);
    expect(url.length).toBeLessThan(2048);
  });
});

/** Wraps the demo provider to count real compute calls (cache verification). */
class CountingProvider implements MapsProvider {
  calls = 0;
  private inner = new DemoMapsProvider();
  optimizeRoute(input: OptimizeRouteInput): Promise<OptimizedRoute> {
    this.calls += 1;
    return this.inner.optimizeRoute(input);
  }
}

describe("cache — compute at most once per demo-day per variant", () => {
  it("second call is a cache read; recompute refreshes and audit-logs", async () => {
    await db.execute(sql`delete from routes_cache`);
    const provider = new CountingProvider();

    const first = await getOrComputeTodayRoute({}, provider);
    expect(first).not.toBeNull();
    expect(provider.calls).toBe(1);

    const second = await getOrComputeTodayRoute({}, provider);
    expect(provider.calls).toBe(1); // no provider hit
    expect(second).toEqual(first);

    const third = await getOrComputeTodayRoute({ forceRecompute: true, actor: "system" }, provider);
    expect(provider.calls).toBe(2);
    expect(third!.routeDate).toBe(first!.routeDate);

    const rows = await db
      .select()
      .from(routesCache)
      .where(and(eq(routesCache.routeDate, first!.routeDate), eq(routesCache.variant, "default")));
    expect(rows).toHaveLength(1); // upsert, not a second row

    const audits = await db.select().from(auditLog).where(eq(auditLog.action, "route.recomputed"));
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("variants cache separately and the key is order-insensitive", async () => {
    expect(variantKey({})).toBe("default");
    expect(variantKey({ roundTrip: true })).toBe("rt");
    expect(variantKey({ excludeStopIds: ["b", "a"] })).toBe(variantKey({ excludeStopIds: ["a", "b"] }));

    const provider = new CountingProvider();
    const rt = await getOrComputeTodayRoute({ roundTrip: true }, provider);
    expect(provider.calls).toBe(1);
    expect(rt!.route.legs[rt!.route.legs.length - 1]!.toId).toBe("origin");
    expect(rt!.route.legs).toHaveLength(rt!.stops.length + 1);
    await getOrComputeTodayRoute({ roundTrip: true }, provider);
    expect(provider.calls).toBe(1);
  });
});

describe("shape parity", () => {
  it("demo provider output parses the shared OptimizedRoute schema", async () => {
    const out = await new DemoMapsProvider().optimizeRoute({
      origin: REP.homeBase,
      stops: [
        { id: "x", label: "X", lat: 35.21, lng: -80.83, arriveBy: at(9, 30) },
        { id: "y", label: "Y", lat: 35.24, lng: -80.81, arriveBy: at(12, 0) },
      ],
      departAfter: at(7, 0),
      roundTrip: false,
    });
    expect(() => OptimizedRouteSchema.parse(out)).not.toThrow();
  });
});

describe("seeded Tuesday", () => {
  it("routes the 3 stops chronologically with exactly one tight chip (the Raleigh run)", async () => {
    const route = await getOrComputeTodayRoute();
    expect(route).not.toBeNull();
    expect(route!.route.orderedStopIds).toEqual([STONEBRIDGE, LUNCH, ATELIER]);

    // Exactly one amber chip: leaving for Atelier North (Raleigh, ~2.5 h out)
    // collides with the 12:00–1:00 distributor lunch.
    expect(route!.leaveBys[ATELIER]!.tight).toBe(true);
    expect(route!.leaveBys[STONEBRIDGE]!.tight).toBe(false);
    expect(route!.leaveBys[LUNCH]!.tight).toBe(false);
    const lunchEnd = new Date(route!.stops.find((s) => s.id === LUNCH)!.endsAt);
    expect(new Date(route!.leaveBys[ATELIER]!.leaveBy).getTime()).toBeLessThan(lunchEnd.getTime());
    // The lunch stop carries the wrap-by deadline for the Raleigh run.
    expect(route!.leaveBys[LUNCH]!.departBy).toBe(route!.leaveBys[ATELIER]!.leaveBy);

    // Tooltip exposes the arithmetic inputs.
    expect(route!.leaveBys[ATELIER]!.tooltip).toContain("drive from");
    expect(route!.leaveBys[ATELIER]!.tooltip).toContain(`${BUFFER_MIN} min buffer`);

    // Well-formed share link, waypoints pre-ordered, within limits.
    const url = new URL(route!.route.shareUrl);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(route!.route.shareUrl.length).toBeLessThan(2048);
    expect(route!.route.linkTruncatedStopIds).toEqual([]);

    // Plausible totals: Charlotte metro hops + the Charlotte→Raleigh leg.
    expect(route!.route.totalDurationSec).toBeGreaterThan(2.5 * 3600);
    expect(route!.route.totalDurationSec).toBeLessThan(5 * 3600);
    expect(route!.route.totalDistanceMeters).toBeGreaterThan(200_000);
  });
});
