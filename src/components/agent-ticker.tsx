"use client";

/**
 * Agent activity ticker (docs/03 §2) — thin strip of live/recent runs shown
 * everywhere in the shell. Items deep-link to the run drawer on Mission
 * Control.
 *
 * `useRecentRuns()` is the ONE shared poll source for both this ticker and the
 * dashboard runs panel (WO-02): a single module-level interval hits
 * /api/runs/recent every 5s, is visibility-aware (skips while the tab is
 * hidden, refetches on re-show), and fans results out to every subscriber via
 * useSyncExternalStore — no duplicate polling. The running-status dot pulse is
 * the only animation and is suppressed under prefers-reduced-motion (globals).
 */
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type ClientRun = {
  id: string;
  agentName: string;
  trigger: "nightly" | "user" | "workflow" | "system";
  status: "running" | "succeeded" | "escalated" | "failed";
  model: string | null;
  costUsd: string;
  elapsedMs: number;
  summary: string;
};

// ── Shared poll source (single interval, many subscribers) ───────────────────

const EMPTY: ClientRun[] = [];
let snapshot: ClientRun[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function emit(): void {
  for (const l of listeners) l();
}

async function poll(): Promise<void> {
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    const res = await fetch(`/api/runs/recent?limit=20`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { runs: ClientRun[] };
    snapshot = data.runs;
  } catch {
    // transient — the next tick retries
  } finally {
    loaded = true;
    emit();
  }
}

function onVisibility(): void {
  if (!document.hidden) void poll();
}

function startPolling(): void {
  if (running) return;
  running = true;
  void poll();
  timer = setInterval(poll, 5000);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
}

function stopPolling(): void {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  startPolling();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stopPolling();
  };
}

/** Live recent runs, shared across every mounted consumer. */
export function useRecentRuns(): ClientRun[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

/** True once the first poll has resolved — lets consumers show a skeleton. */
export function useRunsLoaded(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
}

// ── Ticker ───────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<ClientRun["status"], string> = {
  running: "bg-accent status-running",
  succeeded: "bg-ok",
  escalated: "bg-warn",
  failed: "bg-danger",
};

export function AgentTicker() {
  const runs = useRecentRuns();
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
