/**
 * Live MapsProvider on the Google Routes API — computeRoutes with
 * optimizeWaypointOrder + TRAFFIC_AWARE (WO-12; the legacy Directions API is
 * off-limits). Field mask keeps requests on the cheap SKU.
 */
import { env } from "@/lib/env";
import type { MapsProvider, OptimizedRoute, OptimizeRouteInput, RouteLeg } from "./types";
import { buildShareUrl } from "./share-url";

export class GoogleRoutesMapsProvider implements MapsProvider {
  async optimizeRoute(input: OptimizeRouteInput): Promise<OptimizedRoute> {
    if (!env.GOOGLE_MAPS_API_KEY) {
      throw new Error("Live route optimization requires GOOGLE_MAPS_API_KEY (or set DEMO_MODE=true)");
    }
    const { origin, stops, roundTrip } = input;
    const last = stops[stops.length - 1];
    if (!last) throw new Error("optimizeRoute requires at least one stop");
    const destination = roundTrip ? origin : { lat: last.lat, lng: last.lng };
    const intermediates = roundTrip ? stops : stops.slice(0, -1);

    const body = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      intermediates: intermediates.map((s) => ({ location: { latLng: { latitude: s.lat, longitude: s.lng } } })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      departureTime: input.departAfter.toISOString(),
      optimizeWaypointOrder: intermediates.length > 1,
    };
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask":
          "routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Routes API failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      routes: {
        optimizedIntermediateWaypointIndex?: number[];
        legs: { duration: string; distanceMeters: number }[];
      }[];
    };
    const route = data.routes[0];
    if (!route) throw new Error("Routes API returned no route");

    const order = route.optimizedIntermediateWaypointIndex ?? intermediates.map((_, i) => i);
    const orderedIntermediates = order.map((i) => intermediates[i]!);
    const orderedStops = roundTrip ? orderedIntermediates : [...orderedIntermediates, last];

    const nodeIds = ["origin", ...orderedStops.map((s) => s.id), ...(roundTrip ? ["origin"] : [])];
    const legs: RouteLeg[] = route.legs.map((l, i) => ({
      fromId: nodeIds[i] ?? "origin",
      toId: nodeIds[i + 1] ?? "origin",
      durationSec: parseInt(l.duration.replace(/s$/, ""), 10),
      distanceMeters: l.distanceMeters,
    }));

    const waypoints = (roundTrip ? orderedStops : orderedStops.slice(0, -1)).map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
    }));
    const { url, truncatedStopIds } = buildShareUrl({ origin, destination, waypointsInOrder: waypoints });

    return {
      orderedStopIds: orderedStops.map((s) => s.id),
      legs,
      totalDurationSec: legs.reduce((a, l) => a + l.durationSec, 0),
      totalDistanceMeters: legs.reduce((a, l) => a + l.distanceMeters, 0),
      shareUrl: url,
      computedAt: input.departAfter.toISOString(),
      linkTruncatedStopIds: truncatedStopIds,
    };
  }
}
