/**
 * Google Maps deep-link builder (WO-12 task 1). The link does NOT
 * re-optimize: waypoints must already be in computed order. ≤ 9 waypoints,
 * URL-encoded, total length < 2048 chars; overflow stops are truncated from
 * the LINK only (never from the computed route) and reported.
 */
export function buildShareUrl(opts: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypointsInOrder: { id: string; lat: number; lng: number }[];
}): { url: string; truncatedStopIds: string[] } {
  const fmt = (p: { lat: number; lng: number }) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const truncated: string[] = [];
  let waypoints = [...opts.waypointsInOrder];
  if (waypoints.length > 9) {
    truncated.push(...waypoints.slice(9).map((w) => w.id));
    waypoints = waypoints.slice(0, 9);
  }
  const build = (wps: typeof waypoints) => {
    const params = new URLSearchParams({
      api: "1",
      origin: fmt(opts.origin),
      destination: fmt(opts.destination),
      travelmode: "driving",
    });
    if (wps.length > 0) params.set("waypoints", wps.map(fmt).join("|"));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  };
  let url = build(waypoints);
  while (url.length >= 2048 && waypoints.length > 0) {
    const dropped = waypoints.pop()!;
    truncated.push(dropped.id);
    url = build(waypoints);
  }
  return { url, truncatedStopIds: truncated };
}
