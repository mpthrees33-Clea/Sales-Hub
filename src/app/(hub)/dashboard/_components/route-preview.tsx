/**
 * Route map preview (WO-02 task 6) — a STATIC placeholder. It lists the day's
 * stops in seeded order and links to /routes; it makes zero Maps API calls.
 * TODO(WO-12): replace this stylized card with a real optimized-route thumbnail
 * (order, legs, leave-by) from MapsProvider.
 */
import Link from "next/link";
import { ArrowRight, Navigation } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";

export type RouteStop = { id: string; title: string; location: string | null };

export function RoutePreview({ stops }: { stops: RouteStop[] }) {
  return (
    <Card>
      <CardHeader
        title="Route"
        n="03"
        right={
          <Link href="/routes" className="flex items-center gap-1 font-mono text-[10px] text-accent hover:underline">
            Routes <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      <div className="p-4">
        {/* Stylized, non-interactive map plate — deliberately not a live map. */}
        <div className="relative mb-3 h-24 overflow-hidden rounded-md border border-line bg-surface2">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
            aria-hidden
          />
          <div className="absolute left-3 top-3 flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
            <Navigation className="h-3 w-3 text-accent" strokeWidth={2} /> {stops.length}-stop day
          </div>
        </div>
        {stops.length === 0 ? (
          <p className="font-mono text-[11px] text-ink-faint">No stops today.</p>
        ) : (
          <ol className="space-y-1.5">
            {stops.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2 text-[11px]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[9px] text-ink-muted">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="text-ink">{s.title}</span>
                  {s.location ? <span className="block truncate text-ink-faint">{s.location}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
