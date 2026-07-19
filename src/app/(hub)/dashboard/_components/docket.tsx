import { CalendarClock } from "lucide-react";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { formatTimeShort } from "@/lib/dates";
import { todaysDocket } from "@/lib/queries/dashboard";
import { leaveBysForToday } from "@/lib/leave-bys";
import { LeaveByChip } from "./leave-by-chip";

export async function Docket() {
  const items = await todaysDocket();
  const leaveBys = await leaveBysForToday();
  return (
    <Card>
      <CardHeader n="02" title="Today's Docket" />
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No meetings today"
          copy="Meetings on the demo day appear here with prep notes and leave-by times."
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-4 py-3">
              <div className="w-16 shrink-0 pt-0.5">
                <div className="font-mono text-xs text-ink">{formatTimeShort(m.startsAt)}</div>
                <div className="font-mono text-[10px] text-ink-faint">{formatTimeShort(m.endsAt)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium">{m.title}</span>
                  {m.isNext ? <StatusPill tone="accent">NEXT</StatusPill> : null}
                </div>
                {m.location ? <p className="mt-0.5 truncate text-[11px] text-ink-muted">{m.location}</p> : null}
                {m.prepNotes ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer list-none text-[11px] leading-snug text-ink-muted [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] hover:text-ink">
                      {m.prepNotes}
                    </summary>
                  </details>
                ) : null}
              </div>
              <LeaveByChip leaveBy={leaveBys.get(m.id)?.leaveBy} tight={leaveBys.get(m.id)?.tight} tooltip={leaveBys.get(m.id)?.tooltip} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
