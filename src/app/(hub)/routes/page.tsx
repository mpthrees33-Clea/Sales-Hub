/** Day route (WO-12 task 5) — optimized stops, leave-by chips, Maps deep link. */
import Link from "next/link";
import { Clock, ExternalLink, MapPin, Navigation } from "lucide-react";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { RouteMap } from "@/components/route-map";
import { formatTimeShort } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { getOrComputeTodayRoute, listTodayStops, orderedWithLeaveBy, type RouteConfig } from "@/lib/routes";
import { RouteControls } from "./controls";

export const dynamic = "force-dynamic";

function fmtDrive(sec: number): string {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ roundTrip?: string; exclude?: string }> }) {
  const { roundTrip: rt, exclude } = await searchParams;
  const cfg: RouteConfig = { roundTrip: rt === "1", excludeIds: exclude ? exclude.split(",").filter(Boolean) : [] };
  const payload = await getOrComputeTodayRoute(cfg);
  const now = await getDemoNow();
  const rows = orderedWithLeaveBy(payload);
  const allStops = await listTodayStops(); // includes excluded stops so they can be re-included
  const excludedSet = new Set(cfg.excludeIds);

  if (allStops.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-lg font-semibold tracking-tight">Route</h1>
        <Card><EmptyState icon={Navigation} title="No stops with coordinates today" copy="Today's meetings become an optimized driving day with leave-by times and a one-tap Maps link." /></Card>
      </div>
    );
  }

  const totalDrive = fmtDrive(payload.route.totalDurationSec);
  const totalMiles = (payload.route.totalDistanceMeters / 1609.34).toFixed(1);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Route</h1>
        <a href={payload.route.shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink hover:opacity-90">
          <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
        </a>
      </div>

      <Card className="p-3 space-y-3">
        <RouteMap origin={payload.origin} orderedStops={rows.map((r) => ({ id: r.stop.id, label: r.stop.title, lat: r.stop.lat, lng: r.stop.lng }))} roundTrip={payload.roundTrip} />
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-accent" /> {rows.length}-stop day · {totalDrive} driving · {totalMiles} mi</span>
          <span className="text-ink-faint">from {payload.origin.label.split(" — ")[0]}</span>
        </div>
        <RouteControls roundTrip={cfg.roundTrip} excludeIds={cfg.excludeIds} stops={allStops.map((s) => ({ id: s.id, title: s.title, excluded: excludedSet.has(s.id) }))} />
      </Card>

      <Card>
        <CardHeader title="Stops" right={<span className="font-mono text-[10px] text-ink-faint">optimized order</span>} />
        <ol className="divide-y divide-line">
          {rows.map(({ stop, chip }, i) => {
            const leaveByPassed = chip.leaveBy ? chip.leaveBy < now : false;
            return (
              <li key={stop.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dim font-mono text-[11px] text-accent">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium">{stop.title}</span>
                    {stop.arriveBy ? <span className="font-mono text-[10px] text-ink-faint">{formatTimeShort(new Date(stop.arriveBy))}</span> : null}
                  </div>
                  {stop.location ? <p className="flex items-center gap-1 truncate font-mono text-[10px] text-ink-faint"><MapPin className="h-3 w-3" /> {stop.location}</p> : null}
                  {stop.prepNote ? <p className="mt-0.5 truncate text-[11px] text-ink-muted">{stop.prepNote}</p> : null}
                </div>
                {chip.leaveBy ? (
                  <span title={chip.inputs} className="shrink-0">
                    <StatusPill tone={chip.tight ? "warn" : leaveByPassed ? "muted" : "accent"}>
                      <Clock className="h-3 w-3" /> leave {formatTimeShort(chip.leaveBy)}{chip.tight ? " · tight" : ""}
                    </StatusPill>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        {payload.route.linkTruncatedStopIds.length > 0 ? (
          <p className="border-t border-line px-4 py-2 font-mono text-[10px] text-warn">Maps link caps at 9 waypoints — {payload.route.linkTruncatedStopIds.length} stop(s) omitted from the link only (all remain in the route above).</p>
        ) : null}
      </Card>

      <p className="text-center font-mono text-[10px] text-ink-faint">Computed {new Date(payload.route.computedAt) <= now ? "for" : ""} today · <Link href="/dashboard" className="text-accent hover:underline">back to dashboard</Link></p>
    </div>
  );
}
