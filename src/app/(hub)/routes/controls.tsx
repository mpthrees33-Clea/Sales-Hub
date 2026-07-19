"use client";

/** Route controls (WO-12 task 5) — round-trip toggle, include/exclude stops, recompute. */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { recomputeRouteAction } from "./actions";

type StopToggle = { id: string; title: string; excluded: boolean };

export function RouteControls({ roundTrip, excludeIds, stops }: { roundTrip: boolean; excludeIds: string[]; stops: StopToggle[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const pushConfig = (next: { roundTrip?: boolean; excludeIds?: string[] }) => {
    const rt = next.roundTrip ?? roundTrip;
    const excl = next.excludeIds ?? excludeIds;
    const params = new URLSearchParams();
    if (rt) params.set("roundTrip", "1");
    if (excl.length) params.set("exclude", excl.join(","));
    router.push(`/routes${params.toString() ? `?${params}` : ""}`);
  };

  const toggleExclude = (id: string) => {
    const next = excludeIds.includes(id) ? excludeIds.filter((x) => x !== id) : [...excludeIds, id];
    pushConfig({ excludeIds: next });
  };

  const recompute = () => startTransition(async () => { await recomputeRouteAction({ roundTrip, excludeIds }); router.refresh(); });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => pushConfig({ roundTrip: !roundTrip })}
        className={cn("rounded-full border px-2.5 py-1 font-mono text-[10px]", roundTrip ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}
      >
        round trip {roundTrip ? "on" : "off"}
      </button>
      {stops.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => toggleExclude(s.id)}
          title={s.excluded ? "Include this stop" : "Exclude this stop"}
          className={cn("rounded-full border px-2.5 py-1 font-mono text-[10px]", s.excluded ? "border-line text-ink-faint line-through" : "border-line text-ink-muted hover:text-ink")}
        >
          {s.title.split(" — ")[0]}
        </button>
      ))}
      <button
        type="button"
        onClick={recompute}
        disabled={pending}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line bg-surface2 px-2.5 py-1 text-[11px] font-medium hover:border-line-strong disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} recompute
      </button>
    </div>
  );
}
