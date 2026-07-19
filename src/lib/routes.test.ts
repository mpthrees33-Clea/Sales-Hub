/**
 * WO-12: deterministic route math. Leave-by arithmetic + backward-walk conflict
 * flagging; the Google Maps deep-link builder (order preserved, encoded, ≤ 9
 * waypoints, length-capped); and the per-demo-day cache (second call reads the
 * stored payload, no recompute).
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { db } from "@/db/client";
import { routesCache } from "@/db/schema";
import { computeLeaveBy, getOrComputeTodayRoute, orderedWithLeaveBy, variantKey } from "@/lib/routes";
import { buildShareUrl } from "@/providers/maps/share-url";

beforeAll(() => {
  execSync("pnpm seed", { cwd: process.cwd(), stdio: "ignore" });
}, 60_000);

const iso = (h: number, m = 0) => new Date(Date.UTC(2026, 2, 10, h, m));

describe("computeLeaveBy", () => {
  it("leaveBy = arriveBy − incoming leg − buffer", () => {
    const stops = [{ id: "a", arriveBy: iso(14, 0), endsAt: iso(15, 0) }];
    const legs = [{ fromId: "origin", toId: "a", durationSec: 25 * 60 }];
    const [chip] = computeLeaveBy(stops, legs, 15);
    // 14:00 − 25m − 15m = 13:20
    expect(chip!.leaveBy!.getTime()).toBe(iso(13, 20).getTime());
    expect(chip!.tight).toBe(false);
    expect(chip!.inputs).toMatch(/drive/);
  });

  it("flags a stop tight when its leave-by falls before the previous meeting ends", () => {
    const stops = [
      { id: "a", arriveBy: iso(12, 0), endsAt: iso(13, 0) }, // lunch until 13:00
      { id: "b", arriveBy: iso(15, 0), endsAt: iso(16, 0) }, // far stop needing a 2.5h drive
    ];
    const legs = [
      { fromId: "origin", toId: "a", durationSec: 20 * 60 },
      { fromId: "a", toId: "b", durationSec: 150 * 60 }, // 2.5h → leaveBy_b = 15:00 − 2.5h − 15m = 12:15
    ];
    const chips = computeLeaveBy(stops, legs, 15);
    const b = chips.find((c) => c.stopId === "b")!;
    expect(b.leaveBy!.getTime()).toBe(iso(12, 15).getTime());
    expect(b.tight).toBe(true); // 12:15 < previous meeting end (13:00)
  });
});

describe("buildShareUrl", () => {
  const o = { lat: 35.1, lng: -80.8 };
  const wp = (id: string, n: number) => ({ id, lat: 35 + n / 100, lng: -80 - n / 100 });

  it("preserves waypoint order and URL-encodes", () => {
    const { url } = buildShareUrl({ origin: o, destination: wp("d", 9), waypointsInOrder: [wp("w1", 1), wp("w2", 2)] });
    expect(url).toContain("https://www.google.com/maps/dir/?");
    expect(url).toContain("travelmode=driving");
    const wpParam = new URL(url).searchParams.get("waypoints")!;
    expect(wpParam.split("|")[0]).toContain("35.010000"); // w1 before w2
    expect(wpParam.split("|")[1]).toContain("35.020000");
  });

  it("truncates beyond 9 waypoints (from the link only) and reports them", () => {
    const many = Array.from({ length: 12 }, (_, i) => wp(`w${i}`, i + 1));
    const { url, truncatedStopIds } = buildShareUrl({ origin: o, destination: wp("d", 20), waypointsInOrder: many });
    expect(new URL(url).searchParams.get("waypoints")!.split("|").length).toBeLessThanOrEqual(9);
    expect(truncatedStopIds.length).toBe(3);
    expect(url.length).toBeLessThan(2048);
  });
});

describe("route cache", () => {
  it("computes once per demo-day+config and reads the stored payload thereafter", async () => {
    await db.delete(routesCache);
    const first = await getOrComputeTodayRoute({ roundTrip: false, excludeIds: [] });
    expect(first.stops.length).toBeGreaterThanOrEqual(3);
    expect(first.route.orderedStopIds.length).toBe(first.stops.length);
    expect(first.route.shareUrl).toContain("google.com/maps/dir");

    const rowsAfterFirst = await db.select().from(routesCache);
    expect(rowsAfterFirst.length).toBe(1);

    // Tamper the cached payload; a second call must return it unchanged (no recompute).
    const marker = { ...first, departAfter: "TAMPERED" };
    await db.update(routesCache).set({ payload: marker });
    const second = await getOrComputeTodayRoute({ roundTrip: false, excludeIds: [] });
    expect(second.departAfter).toBe("TAMPERED");
    expect((await db.select().from(routesCache)).length).toBe(1);
  });

  it("keys distinct configs to distinct cache variants", () => {
    expect(variantKey({ roundTrip: false, excludeIds: [] })).not.toBe(variantKey({ roundTrip: true, excludeIds: [] }));
    expect(variantKey({ roundTrip: false, excludeIds: ["a", "b"] })).toBe(variantKey({ roundTrip: false, excludeIds: ["b", "a"] }));
  });

  it("orders stops chronologically with leave-by chips", async () => {
    const payload = await getOrComputeTodayRoute({ roundTrip: false, excludeIds: [] });
    const rows = orderedWithLeaveBy(payload);
    expect(rows.length).toBe(payload.route.orderedStopIds.length);
    expect(rows.every((r) => r.chip)).toBe(true);
  });
});
