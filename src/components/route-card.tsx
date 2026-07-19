import Link from "next/link";
import { ArrowRight, Car, ExternalLink, Map as MapIcon } from "lucide-react";
import { Card, CardHeader, Mono } from "@/components/ui";
import { formatTimeShort } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { formatDriveDuration, formatMiles, getOrComputeTodayRoute } from "@/lib/routes";

/**
 * Dashboard route card (WO-12 task 6, fills the WO-02 slot): next stop, its
 * leave-by countdown against the demo clock, day totals, and the Maps deep
 * link. Reads the cached route — zero Maps API calls per render after the
 * day's first compute.
 */
export async function RouteCard() {
  const [route, demoNow] = await Promise.all([getOrComputeTodayRoute().catch(() => null), getDemoNow()]);

  if (!route || route.stops.length === 0) {
    return (
      <Card>
        <CardHeader n="04" title="Today's Route" right={<MapIcon className="h-3.5 w-3.5 text-ink-faint" />} />
        <div className="p-4">
          <p className="text-xs text-ink-muted">No stops today.</p>
          <RoutesLink />
        </div>
      </Card>
    );
  }

  const next = route.stops.find((s) => new Date(s.endsAt).getTime() >= demoNow.getTime());
  const nextLeaveBy = next ? route.leaveBys[next.id] : undefined;
  const countdownMin = nextLeaveBy
    ? Math.round((new Date(nextLeaveBy.leaveBy).getTime() - demoNow.getTime()) / 60_000)
    : null;

  return (
    <Card>
      <CardHeader n="04" title="Today's Route" right={<MapIcon className="h-3.5 w-3.5 text-ink-faint" />} />
      <div className="space-y-3 p-4">
        {next ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Next stop</p>
            <p className="mt-0.5 truncate text-[13px] font-medium">{next.title}</p>
            <p className="truncate text-[11px] text-ink-muted">
              {formatTimeShort(new Date(next.startsAt))}
              {next.accountName ? ` · ${next.accountName}` : ""}
            </p>
            {nextLeaveBy && countdownMin !== null ? (
              <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] ${
                  countdownMin <= 0 || nextLeaveBy.tight ? "bg-warn-dim text-warn" : "bg-accent-dim text-accent"
                }`}
                title={nextLeaveBy.tooltip}
              >
                <Car className="h-3 w-3" strokeWidth={1.75} />
                {countdownMin > 0
                  ? `leave by ${formatTimeShort(new Date(nextLeaveBy.leaveBy))} · in ${countdownMin}m`
                  : "leave now"}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] text-ink-muted">All stops done — {route.stops.length} today.</p>
        )}

        <Mono className="block text-[10px] text-ink-faint">
          {route.stops.length} stops · {formatDriveDuration(route.route.totalDurationSec)} drive ·{" "}
          {formatMiles(route.route.totalDistanceMeters)}
        </Mono>

        <div className="flex items-center gap-3">
          <a
            href={route.route.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-accent transition-opacity hover:opacity-80"
          >
            Open in Google Maps <ExternalLink className="h-3 w-3" />
          </a>
          <RoutesLink />
        </div>
      </div>
    </Card>
  );
}

function RoutesLink() {
  return (
    <Link
      href="/routes"
      className="inline-flex items-center gap-1 text-[12px] text-accent transition-opacity hover:opacity-80"
    >
      Routes <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
