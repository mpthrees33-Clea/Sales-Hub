import Link from "next/link";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { formatTimeShort } from "@/lib/dates";
import { todaysDocket } from "@/lib/queries/dashboard";

/**
 * Route card slot. Placeholder listing the day's stops in seeded order;
 * TODO(WO-12): swap body for <RouteCard /> with optimized order, leave-by
 * countdown, and the Maps deep link. Zero Maps API calls here.
 */
export async function RoutePreview() {
  const stops = await todaysDocket();
  return (
    <Card>
      <CardHeader n="04" title="Today's Route" right={<MapIcon className="h-3.5 w-3.5 text-ink-faint" />} />
      <div className="p-4">
        {stops.length === 0 ? (
          <p className="text-xs text-ink-muted">No stops today.</p>
        ) : (
          <ol className="space-y-2">
            {stops.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2.5 text-[12px]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[10px] text-ink-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-ink-faint">{formatTimeShort(s.startsAt)}</span>
              </li>
            ))}
          </ol>
        )}
        <Link
          href="/routes"
          className="mt-3 inline-flex items-center gap-1 text-[12px] text-accent transition-opacity hover:opacity-80"
        >
          Routes <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
