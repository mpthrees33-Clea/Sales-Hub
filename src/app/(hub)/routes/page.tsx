import Link from "next/link";
import { ExternalLink, Map as MapIcon, RotateCcw } from "lucide-react";
import { LeaveByChip } from "@/app/(hub)/dashboard/_components/leave-by-chip";
import { Card, CardHeader, EmptyState, Mono } from "@/components/ui";
import { formatDateLong, formatTimeShort } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { todaysDocket } from "@/lib/queries/dashboard";
import { formatDriveDuration, formatMiles, getOrComputeTodayRoute, type DayRoute } from "@/lib/routes";
import { RecomputeButton } from "./recompute-button";

export const dynamic = "force-dynamic";

/**
 * /routes (WO-12 task 5): geo-ordered stops with leave-by chips, day totals,
 * dependency-light SVG map, and the Google Maps deep link with waypoints
 * already in optimized order. Deterministic math — no LLM in this module.
 */
export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ rt?: string; exclude?: string }>;
}) {
  const params = await searchParams;
  const roundTrip = params.rt === "1";
  const excludeStopIds = params.exclude ? params.exclude.split(",").filter(Boolean) : [];

  const [route, docket, demoNow] = await Promise.all([
    getOrComputeTodayRoute({ roundTrip, excludeStopIds }),
    todaysDocket(),
    getDemoNow(),
  ]);

  const query = (rt: boolean, exclude: string[]) => {
    const p = new URLSearchParams();
    if (rt) p.set("rt", "1");
    if (exclude.length > 0) p.set("exclude", exclude.join(","));
    const s = p.toString();
    return s ? `/routes?${s}` : "/routes";
  };
  const excludedMeetings = docket.filter((m) => excludeStopIds.includes(m.id));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Day route</h1>
          <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
            {formatDateLong(demoNow)} · deterministic math — meeting start − drive time − 15 min buffer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecomputeButton roundTrip={roundTrip} excludeStopIds={excludeStopIds} />
          {route ? (
            <a
              href={route.route.shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90"
            >
              Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      {!route ? (
        <Card>
          <EmptyState icon={MapIcon} title="No route today" copy="No meetings with locations on today's calendar." />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Mono className="text-[11px] text-ink-muted">
              {route.stops.length} stops · {formatDriveDuration(route.route.totalDurationSec)} driving ·{" "}
              {formatMiles(route.route.totalDistanceMeters)}
              {route.roundTrip ? " · round trip" : ""}
            </Mono>
            <Link
              href={query(!roundTrip, excludeStopIds)}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:opacity-80"
            >
              <RotateCcw className="h-3 w-3" />
              {roundTrip ? "End at last stop" : "Return to office"}
            </Link>
            {route.route.linkTruncatedStopIds.length > 0 ? (
              <span className="font-mono text-[11px] text-warn">
                {route.route.linkTruncatedStopIds.length} stop(s) omitted from the Maps link (9-waypoint limit) — the
                computed route includes them all.
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-3">
              {route.stops.map((stop, i) => {
                const lb = route.leaveBys[stop.id];
                const leg = route.route.legs.find((l) => l.toId === stop.id);
                return (
                  <Card key={stop.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dim font-mono text-[11px] text-accent">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[13px] font-medium">{stop.title}</p>
                          <LeaveByChip
                            leaveBy={lb ? new Date(lb.leaveBy) : undefined}
                            tight={lb?.tight}
                            tooltip={lb?.tooltip}
                          />
                        </div>
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {formatTimeShort(new Date(stop.startsAt))}–{formatTimeShort(new Date(stop.endsAt))}
                          {stop.accountName ? ` · ${stop.accountName}` : ""}
                        </p>
                        {stop.location ? (
                          <Mono className="mt-0.5 block truncate text-[10px] text-ink-faint">{stop.location}</Mono>
                        ) : null}
                        {stop.prepNotes ? (
                          <p className="mt-1.5 truncate text-[11px] text-ink-muted" title={stop.prepNotes}>
                            {stop.prepNotes}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {leg ? (
                            <Mono className="text-[10px] text-ink-faint">
                              {formatDriveDuration(leg.durationSec)} · {formatMiles(leg.distanceMeters)} from{" "}
                              {lb?.inputs.fromLabel ?? "previous stop"}
                            </Mono>
                          ) : null}
                          {lb?.departBy ? (
                            <Mono className="text-[10px] text-warn">
                              wrap by {formatTimeShort(new Date(lb.departBy))} to make the next stop
                            </Mono>
                          ) : null}
                          <Link
                            href={query(roundTrip, [...excludeStopIds, stop.id])}
                            className="font-mono text-[10px] text-ink-faint underline-offset-2 hover:text-ink hover:underline"
                          >
                            exclude
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {excludedMeetings.length > 0 ? (
                <Card className="p-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Excluded from route</p>
                  <ul className="mt-2 space-y-1.5">
                    {excludedMeetings.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-[12px] text-ink-muted">
                        <span className="truncate">
                          {formatTimeShort(m.startsAt)} · {m.title}
                        </span>
                        <Link
                          href={query(roundTrip, excludeStopIds.filter((id) => id !== m.id))}
                          className="shrink-0 font-mono text-[10px] text-accent hover:opacity-80"
                        >
                          include
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {route.unroutable.length > 0 ? (
                <p className="font-mono text-[10px] text-ink-faint">
                  No location on: {route.unroutable.map((u) => u.title).join(" · ")}
                </p>
              ) : null}
            </div>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader n="01" title="Map" right={<MapIcon className="h-3.5 w-3.5 text-ink-faint" />} />
                <div className="p-3">
                  <RouteMap route={route} />
                  <Mono className="mt-2 block text-[9px] text-ink-faint">
                    origin: {route.origin.label}
                  </Mono>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Dependency-light inline SVG: polyline over stop markers (no map SDK). */
function RouteMap({ route }: { route: DayRoute }) {
  const W = 560;
  const H = 400;
  const PAD = 44;
  const points = [
    { id: "origin", label: "HQ", lat: route.origin.lat, lng: route.origin.lng },
    ...route.stops.map((s, i) => ({ id: s.id, label: `${i + 1}`, lat: s.lat, lng: s.lng })),
  ];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(maxLat - minLat, 0.01);
  const spanLng = Math.max(maxLng - minLng, 0.01);
  const x = (lng: number) => PAD + ((lng - minLng) / spanLng) * (W - 2 * PAD);
  const y = (lat: number) => H - PAD - ((lat - minLat) / spanLat) * (H - 2 * PAD);

  const path = [...points, ...(route.roundTrip ? [points[0]!] : [])];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-md border border-line bg-bg"
      role="img"
      aria-label="Route map"
    >
      <polyline
        points={path.map((p) => `${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        opacity="0.7"
      />
      {points.map((p) =>
        p.id === "origin" ? (
          <g key={p.id}>
            <rect
              x={x(p.lng) - 6}
              y={y(p.lat) - 6}
              width="12"
              height="12"
              rx="2"
              fill="var(--color-surface2)"
              stroke="var(--color-line-strong)"
            />
            <text
              x={x(p.lng)}
              y={y(p.lat) + 16}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="var(--color-ink-faint)"
            >
              HQ
            </text>
          </g>
        ) : (
          <g key={p.id}>
            <circle cx={x(p.lng)} cy={y(p.lat)} r="9" fill="var(--color-accent-dim)" stroke="var(--color-accent)" />
            <text
              x={x(p.lng)}
              y={y(p.lat) + 3}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="var(--color-accent)"
            >
              {p.label}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}
