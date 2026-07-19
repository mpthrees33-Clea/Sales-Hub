"use client";

/**
 * Agent activity ticker (docs/03 §2) — thin strip of live/recent runs shown
 * everywhere in the shell. Items deep-link to the run drawer on Mission
 * Control. Polls the shared /api/runs/recent source every 5s,
 * visibility-aware; static (no marquee) under prefers-reduced-motion.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TickerRun = {
  id: string;
  agentName: string;
  status: "running" | "succeeded" | "escalated" | "failed";
  summary: string;
};

let sharedCache: { at: number; runs: TickerRun[] } | null = null;

export function useRecentRuns(limit = 20): TickerRun[] {
  const [runs, setRuns] = useState<TickerRun[]>(sharedCache?.runs ?? []);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      if (sharedCache && Date.now() - sharedCache.at < 4500) {
        setRuns(sharedCache.runs);
        return;
      }
      try {
        const res = await fetch(`/api/runs/recent?limit=${limit}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { runs: TickerRun[] };
        sharedCache = { at: Date.now(), runs: data.runs };
        if (!stop) setRuns(data.runs);
      } catch {
        // transient; next poll retries
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [limit]);
  return runs;
}

const STATUS_DOT: Record<TickerRun["status"], string> = {
  running: "bg-accent status-running",
  succeeded: "bg-ok",
  escalated: "bg-warn",
  failed: "bg-danger",
};

export function AgentTicker() {
  const runs = useRecentRuns(8);
  if (runs.length === 0) {
    return (
      <div className="flex h-7 items-center border-b border-line bg-bg px-4 md:px-5">
        <span className="font-mono text-[10px] text-ink-faint">agent activity · idle — runs appear here live</span>
      </div>
    );
  }
  return (
    <div className="flex h-7 items-center gap-4 overflow-x-auto border-b border-line bg-bg px-4 md:px-5 [scrollbar-width:none]">
      {runs.slice(0, 6).map((r) => (
        <Link
          key={r.id}
          href={`/dashboard?run=${r.id}`}
          className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-ink-muted transition-colors hover:text-ink"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[r.status])} />
          {r.summary}
        </Link>
      ))}
    </div>
  );
}
