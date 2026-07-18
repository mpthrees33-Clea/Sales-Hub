"use client";

/**
 * Live agent-runs panel (WO-02 task 8). Reads the shared 5s poll source
 * (useRecentRuns — one SWR key with the ticker, visibility-aware), renders the
 * recent runs with semantic status colors, and opens the run drawer on click by
 * writing ?run=<id> to the URL (deep-linkable).
 */
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useRecentRuns, useRunsLoaded, type ClientRun } from "@/components/agent-ticker";

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

const STATUS: Record<ClientRun["status"], { tone: "accent" | "ok" | "warn" | "danger"; label: string }> = {
  running: { tone: "accent", label: "running" },
  succeeded: { tone: "ok", label: "succeeded" },
  escalated: { tone: "warn", label: "escalated" },
  failed: { tone: "danger", label: "failed" },
};

function RunStatus({ status }: { status: ClientRun["status"] }) {
  const s = STATUS[status];
  return (
    <StatusPill tone={s.tone}>
      {status === "running" ? <span className="h-1.5 w-1.5 rounded-full bg-accent status-running" /> : null}
      {s.label}
    </StatusPill>
  );
}

export function RunsPanel() {
  const runs = useRecentRuns();
  const loaded = useRunsLoaded();
  const router = useRouter();

  const open = (id: string) => router.push(`/dashboard?run=${id}`, { scroll: false });

  return (
    <Card>
      <CardHeader
        title="Agent Runs"
        n="06"
        right={<span className="font-mono text-[10px] text-ink-faint">live · 5s</span>}
      />
      {!loaded ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-9 w-full" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No agent runs yet"
          copy="Every agent run is recorded here — trigger, model, duration, and cost — with a step-level trace on click."
        />
      ) : (
        <div className="divide-y divide-line">
          {/* header row (desktop) */}
          <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_1fr_0.7fr_0.7fr] gap-2 px-4 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-faint md:grid">
            <span>agent</span>
            <span>trigger</span>
            <span>status</span>
            <span>model</span>
            <span className="text-right">dur</span>
            <span className="text-right">cost</span>
          </div>
          {runs.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => open(r.id)}
              className={cn(
                "grid w-full grid-cols-2 items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-surface2",
                "md:grid-cols-[1.4fr_0.8fr_1fr_1fr_0.7fr_0.7fr]",
              )}
            >
              <span className="truncate font-mono text-[12px]">{r.agentName}</span>
              <span className="hidden font-mono text-[11px] text-ink-muted md:block">{r.trigger}</span>
              <span className="justify-self-end md:justify-self-start">
                <RunStatus status={r.status} />
              </span>
              <span className="hidden truncate font-mono text-[11px] text-ink-faint md:block">{r.model ?? "—"}</span>
              <span className="hidden text-right font-mono text-[11px] tabular-nums text-ink-muted md:block">{fmtMs(r.elapsedMs)}</span>
              <span className="hidden text-right font-mono text-[11px] tabular-nums text-ink-faint md:block">
                ${Number(r.costUsd).toFixed(4)}
              </span>
              {/* mobile secondary line */}
              <span className="col-span-2 flex items-center gap-2 font-mono text-[10px] text-ink-faint md:hidden">
                {r.trigger} · {r.model ?? "—"} · {fmtMs(r.elapsedMs)} · ${Number(r.costUsd).toFixed(4)}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
