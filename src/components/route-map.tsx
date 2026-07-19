/**
 * Dependency-light route map (WO-12 task 5) — an inline SVG polyline over stop
 * markers, lat/lng projected into the viewbox. No Google Maps JS SDK, no static
 * map fetch: it renders offline from the cached coordinates.
 */
type Pt = { id: string; label: string; lat: number; lng: number };

export function RouteMap({ origin, orderedStops, roundTrip }: { origin: { label: string; lat: number; lng: number }; orderedStops: Pt[]; roundTrip: boolean }) {
  const path = [{ id: "origin", label: origin.label, lat: origin.lat, lng: origin.lng }, ...orderedStops, ...(roundTrip ? [{ id: "origin2", label: origin.label, lat: origin.lat, lng: origin.lng }] : [])];
  const W = 720;
  const H = 240;
  const PAD = 26;
  const lats = path.map((p) => p.lat);
  const lngs = path.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1;
  const spanLng = maxLng - minLng || 1;
  const x = (lng: number) => PAD + ((lng - minLng) / spanLng) * (W - 2 * PAD);
  const y = (lat: number) => PAD + ((maxLat - lat) / spanLat) * (H - 2 * PAD); // north up

  const poly = path.map((p) => `${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-md border border-line bg-surface2" role="img" aria-label="Route map">
      <defs>
        <pattern id="routegrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--line)" strokeWidth="0.5" opacity="0.5" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#routegrid)" />
      <polyline points={poly} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
      {path.map((p, i) => {
        const isOrigin = p.id === "origin" || p.id === "origin2";
        if (p.id === "origin2") return null;
        return (
          <g key={`${p.id}-${i}`} transform={`translate(${x(p.lng)}, ${y(p.lat)})`}>
            <circle r={isOrigin ? 7 : 9} fill={isOrigin ? "var(--surface)" : "var(--accent)"} stroke={isOrigin ? "var(--line-strong)" : "var(--accent)"} strokeWidth="1.5" />
            {!isOrigin ? <text textAnchor="middle" dy="3.5" fontSize="10" fontFamily="monospace" fill="var(--accent-ink)">{i}</text> : <text textAnchor="middle" dy="3" fontSize="9" fontFamily="monospace" fill="var(--ink-muted)">◆</text>}
          </g>
        );
      })}
    </svg>
  );
}
