"use client";

/**
 * Live agent-runs panel ("watch the harness think"). Shares the 5s poll
 * source with the ticker (one cache — no duplicate polling), pauses when the
 * tab is hidden, and deep-links via /dashboard?run=<id>.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RunTrace, type StepRow } from "@/components/run-trace";
import { Card, CardHeader, StatusPill } from "@/components/ui";
import { formatDurationMs } from "@/lib/dates";
import { cn } from "@/lib/utils";

type ApiRun = {
  id: string;
  agentName: string;
  status: "running" | "succeeded" | "escalated" | "failed";
  trigger: string;
  model: string | null;
  costUsd: string;
  elapsedMs: number;
};

const STATUS_TONE: Record<ApiRun["status"], "accent" | "ok" | "warn" | "danger"> = {
  running: "accent",
  succeeded: "ok",
  escalated: "warn",
  failed: "danger",
};

export function RunsPanel({ initialOpenRunId }: { initialOpenRunId?: string }) {
  const [runs, setRuns] = useState<ApiRun[]>([]);
  const [openRun, setOpenRun] = useState<string | null>(initialOpenRunId ?? null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlRun = searchParams.get("run");
    if (urlRun) setOpenRun(urlRun);
  }, [searchParams]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/runs/recent?limit=20", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { runs: ApiRun[] };
        if (!stop) setRuns(data.runs);
      } catch {
        // transient
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const open = (id: string) => {
    setOpenRun(id);
    router.replace(`/dashboard?run=${id}`, { scroll: false });
  };
  const close = () => {
    setOpenRun(null);
    router.replace("/dashboard", { scroll: false });
  };

  return (
    <>
      <Card>
        <CardHeader n="05" title="Agent Runs" />
        {runs.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">
            No runs yet — agent activity records here, step by step.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {runs.slice(0, 10).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => open(r.id)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-surface2"
                >
                  <StatusPill tone={STATUS_TONE[r.status]} className={cn(r.status === "running" && "status-running")}>
                    {r.status}
                  </StatusPill>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{r.agentName}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                    {formatDurationMs(r.elapsedMs)} · ${Number(r.costUsd).toFixed(3)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {openRun ? <RunDrawer runId={openRun} onClose={close} /> : null}
    </>
  );
}

function RunDrawer({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [data, setData] = useState<{
    run: { agentName: string; status: string; model: string | null; tokensIn: number; tokensOut: number; costUsd: string };
    steps: StepRow[];
  } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
      if (res.status === 404) {
        if (!stop) setMissing(true);
        return;
      }
      if (!res.ok) return;
      const d = await res.json();
      if (!stop) setData(d);
    };
    void load();
    const t = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [runId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-medium">Run trace</h2>
            <p className="font-mono text-[10px] text-ink-faint">{runId}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1.5 hover:bg-surface2">
            <X className="h-4 w-4 text-ink-muted" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-3">
          {missing ? (
            <p className="p-2 text-xs text-ink-muted">Run not found — it may have been cleared by a demo reset.</p>
          ) : !data ? (
            <div className="space-y-2 p-2">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-5 w-4/5" />
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 px-1 font-mono text-[11px] text-ink-muted">
                <span className="text-ink">{data.run.agentName}</span>
                <span>· {data.run.status}</span>
                <span>· {data.run.model}</span>
                <span>
                  · {data.run.tokensIn}/{data.run.tokensOut} tok
                </span>
                <span>· ${Number(data.run.costUsd).toFixed(4)}</span>
              </div>
              <RunTrace steps={data.steps} />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
