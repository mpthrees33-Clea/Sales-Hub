/**
 * Demo MapsProvider — deterministic route computation for the seeded day,
 * shaped identically to the live Routes API output. Keyless, instant, and
 * stable across takes: drive times derive from haversine distance at a fixed
 * effective speed with a per-leg overhead, order via exact brute-force
 * optimization (stop counts are small).
 */
import type { MapsProvider, OptimizedRoute, OptimizeRouteInput, RouteLeg } from "./types";
import { buildShareUrl } from "./share-url";

const METRO_SPEED_KMH = 52; // in-town driving with traffic
const HIGHWAY_SPEED_KMH = 95; // inter-metro legs (I-85 Charlotte↔Raleigh)
const HIGHWAY_THRESHOLD_M = 40_000; // legs longer than this are mostly highway
const PER_LEG_OVERHEAD_SEC = 240; // parking, lights, lot-to-door

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function legBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): {
  durationSec: number;
  distanceMeters: number;
} {
  const straight = haversineMeters(a, b);
  const road = straight * 1.32; // road-network factor
  const speedKmh = road > HIGHWAY_THRESHOLD_M ? HIGHWAY_SPEED_KMH : METRO_SPEED_KMH;
  return {
    distanceMeters: Math.round(road),
    durationSec: Math.round((road / 1000 / speedKmh) * 3600 + PER_LEG_OVERHEAD_SEC),
  };
}

function* permutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield arr;
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i]!, ...p];
  }
}

export class DemoMapsProvider implements MapsProvider {
  async optimizeRoute(input: OptimizeRouteInput): Promise<OptimizedRoute> {
    const { origin, stops, roundTrip } = input;
    if (stops.length === 0) {
      return {
        orderedStopIds: [],
        legs: [],
        totalDurationSec: 0,
        totalDistanceMeters: 0,
        shareUrl: "",
        computedAt: input.departAfter.toISOString(),
        linkTruncatedStopIds: [],
      };
    }

    // Timed stops (meetings) must respect chronology; brute-force order is only
    // for cost — a meeting day is inherently time-ordered, so sort by arriveBy
    // when present and optimize any untimed stops around them.
    const timed = stops.filter((s) => s.arriveBy).sort((a, b) => a.arriveBy!.getTime() - b.arriveBy!.getTime());
    const untimed = stops.filter((s) => !s.arriveBy);
    let best: typeof stops = [];
    let bestCost = Infinity;
    const candidates = untimed.length > 0 ? [...permutations(untimed)] : [[]];
    for (const perm of candidates) {
      const order = [...timed, ...perm];
      let cost = 0;
      let prev: { lat: number; lng: number } = origin;
      for (const s of order) {
        cost += legBetween(prev, s).durationSec;
        prev = s;
      }
      if (roundTrip) cost += legBetween(prev, origin).durationSec;
      if (cost < bestCost) {
        bestCost = cost;
        best = order;
      }
    }

    const legs: RouteLeg[] = [];
    let prev: { id: string; lat: number; lng: number } = { id: "origin", ...origin };
    for (const s of best) {
      const l = legBetween(prev, s);
      legs.push({ fromId: prev.id, toId: s.id, ...l });
      prev = s;
    }
    if (roundTrip) {
      const l = legBetween(prev, origin);
      legs.push({ fromId: prev.id, toId: "origin", ...l });
    }

    const last = best[best.length - 1]!;
    const dest = roundTrip ? origin : { lat: last.lat, lng: last.lng };
    const waypoints = (roundTrip ? best : best.slice(0, -1)).map((s) => ({ id: s.id, lat: s.lat, lng: s.lng }));
    const { url, truncatedStopIds } = buildShareUrl({ origin, destination: dest, waypointsInOrder: waypoints });

    return {
      orderedStopIds: best.map((s) => s.id),
      legs,
      totalDurationSec: legs.reduce((a, l) => a + l.durationSec, 0),
      totalDistanceMeters: legs.reduce((a, l) => a + l.distanceMeters, 0),
      shareUrl: url,
      computedAt: input.departAfter.toISOString(),
      linkTruncatedStopIds: truncatedStopIds,
    };
  }
}
