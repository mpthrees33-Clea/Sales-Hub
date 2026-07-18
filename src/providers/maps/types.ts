/** MapsProvider — optimized multi-stop day routes (docs/01 §6, WO-12). */
export type RouteStop = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /** Meeting start the rep must arrive by (leave-by math uses this). */
  arriveBy?: Date;
};

export type RouteLeg = { fromId: string; toId: string; durationSec: number; distanceMeters: number };

export type OptimizedRoute = {
  orderedStopIds: string[];
  legs: RouteLeg[];
  totalDurationSec: number;
  totalDistanceMeters: number;
  /** google.com/maps/dir link with waypoints ALREADY in optimized order. */
  shareUrl: string;
  computedAt: string; // ISO
  /** Stops dropped from the share link (>9 waypoints) — never from the route. */
  linkTruncatedStopIds: string[];
};

export type OptimizeRouteInput = {
  origin: { label: string; lat: number; lng: number };
  stops: RouteStop[];
  departAfter: Date;
  roundTrip: boolean;
};

export interface MapsProvider {
  optimizeRoute(input: OptimizeRouteInput): Promise<OptimizedRoute>;
}
