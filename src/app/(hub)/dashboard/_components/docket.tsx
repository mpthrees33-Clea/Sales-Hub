/**
 * Today's Docket (WO-02 task 5). Meetings for demo-today via CalendarProvider
 * (the page fetches once and passes them here + to RoutePreview — never the
 * meetings table directly). The next upcoming meeting relative to demo-now is
 * visually marked; each row carries a leave-by chip placeholder that WO-12
 * populates via MapsProvider.
 */
import { CalendarClock, MapPin } from "lucide-react";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui";
import { formatTimeShort } from "@/lib/dates";
import type { DocketItem } from "@/lib/queries/dashboard";

function LeaveByChip({ leaveBy }: { leaveBy?: Date }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-ink-faint"
      title={leaveBy ? undefined : "Route timing lands in WO-12"}
    >
      leave by {leaveBy ? formatTimeShort(leaveBy) : "—"}
    </span>
  );
}

export function Docket({ items }: { items: DocketItem[] }) {
  return (
    <Card>
      <CardHeader title="Today's Docket" n="02" right={<span className="font-mono text-[10px] text-ink-faint">{items.length} stops</span>} />
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing on the calendar today"
          copy="Meetings for the day appear here with prep notes and leave-by timing."
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((m) => (
            <li key={m.id} className={m.isNext ? "border-l-2 border-l-accent" : "border-l-2 border-l-transparent"}>
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-16 shrink-0 pt-0.5">
                  <div className="font-mono text-[13px] tabular-nums">{formatTimeShort(m.startsAt)}</div>
                  {m.isNext ? <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">next up</div> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-medium">{m.title}</p>
                    <LeaveByChip leaveBy={m.leaveBy} />
                  </div>
                  {m.accountName ? <p className="mt-0.5 text-xs text-ink-muted">{m.accountName}</p> : null}
                  {m.location ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
                      <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{m.location}</span>
                    </p>
                  ) : null}
                  {m.prepNotes ? (
                    <details className="group mt-1.5">
                      <summary className="cursor-pointer list-none text-[11px] text-ink-muted marker:hidden">
                        <span className="line-clamp-2 group-open:line-clamp-none">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">prep</span> {m.prepNotes}
                        </span>
                      </summary>
                    </details>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DocketSkeleton() {
  return (
    <Card>
      <CardHeader title="Today's Docket" n="02" />
      <div className="space-y-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-14" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
