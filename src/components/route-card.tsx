/**
 * Dashboard route card (WO-12 task 6) — the compressed 7am glance: next stop,
 * its leave-by countdown against the demo clock, total day drive time, and a
 * one-tap Google Maps link. Self-contained: computes (cache-backed) on render.
 */
import Link from "next/link";
import { ArrowRight, Clock, ExternalLink, Navigation } from "lucide-react";
import { Card, CardHeader, StatusPill } from "@/components/ui";
import { formatTimeShort } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { getOrComputeTodayRoute, orderedWithLeaveBy } from "@/lib/routes";

function fmtDrive(sec: number): string {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function countdown(from: Date, to: Date): string {
  const min = Math.round((to.getTime() - from.getTime()) / 60000);
  if (min < 0) return "departed";
  if (min < 60) return `in ${min}m`;
  return `in ${Math.floor(min / 60)}h ${min % 60}m`;
}

export async function RouteCard() {
  const payload = await getOrComputeTodayRoute();
  const now = await getDemoNow();
  const rows = orderedWithLeaveBy(payload);

  const header = (
    <CardHeader
      title="Route"
      n="03"
      right={<Link href="/routes" className="flex items-center gap-1 font-mono text-[10px] text-accent hover:underline">Routes <ArrowRight className="h-3 w-3" /></Link>}
    />
  );

  if (rows.length === 0) {
    return <Card>{header}<div className="p-4"><p className="font-mono text-[11px] text-ink-faint">No stops today.</p></div></Card>;
  }

  // Next stop = first whose leave-by is still ahead, else the first stop.
  const upcoming = rows.find((r) => r.chip.leaveBy && r.chip.leaveBy >= now) ?? rows[0]!;
  const totalDrive = fmtDrive(payload.route.totalDurationSec);

  return (
    <Card>
      {header}
      <div className="space-y-3 p-4">
        <div className="rounded-md border border-line bg-surface2 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">next stop</span>
            {upcoming.chip.leaveBy ? (
              <span title={upcoming.chip.inputs}>
                <StatusPill tone={upcoming.chip.tight ? "warn" : "accent"}>
                  <Clock className="h-3 w-3" /> leave {formatTimeShort(upcoming.chip.leaveBy)} · {countdown(now, upcoming.chip.leaveBy)}
                </StatusPill>
              </span>
            ) : null}
          </div>
          <div className="text-[13px] font-medium">{upcoming.stop.title}</div>
          {upcoming.stop.location ? <div className="truncate font-mono text-[10px] text-ink-faint">{upcoming.stop.location}</div> : null}
        </div>

        <div className="flex items-center justify-between font-mono text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-accent" /> {rows.length}-stop day · {totalDrive} driving</span>
        </div>

        <a href={payload.route.shareUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-ink hover:opacity-90">
          <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
        </a>
      </div>
    </Card>
  );
}
