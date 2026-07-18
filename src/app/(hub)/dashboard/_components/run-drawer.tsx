"use client";

/**
 * Run drawer (WO-02 tasks 8–9). Opens from the runs panel or a `?run=<id>`
 * deep link (ticker items link here too), fetches the run + its ordered steps,
 * and renders the shared <RunTrace /> — "watch the harness think". Closing
 * clears the query param.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { RunTrace, type StepRow } from "@/components/run-trace";

type RunMeta = {
  id: string;
  agentName: string;
  trigger: string;
  status: "running" | "succeeded" | "escalated" | "failed";
  model: string | null;
  costUsd: string;
  elapsedMs: number;
};

const TONE: Record<RunMeta["status"], "accent" | "ok" | "warn" | "danger"> = {
  running: "accent",
  succeeded: "ok",
  escalated: "warn",
  failed: "danger",
};

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function RunDrawer() {
  const params = useSearchParams();
  const router = useRouter();
  const runId = params.get("run");

  const [run, setRun] = useState<RunMeta | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => router.push("/dashboard", { scroll: false }), [router]);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setSteps([]);
      return;
    }
    let stop = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) {
          if (!stop) {
            setRun(null);
            setSteps([]);
          }
          return;
        }
        const data = (await res.json()) as { run: RunMeta; steps: StepRow[] };
        if (!stop) {
          setRun(data.run);
          setSteps(data.steps);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [runId, close]);

  if (!runId) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Agent run trace">
      <button type="button" aria-label="Close" onClick={close} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-[13px]">{run?.agentName ?? "run"}</span>
              {run ? <StatusPill tone={TONE[run.status]}>{run.status}</StatusPill> : null}
            </div>
            {run ? (
              <p className="mt-1 font-mono text-[10px] text-ink-faint">
                {run.trigger} · {run.model ?? "—"} · {fmtMs(run.elapsedMs)} · ${Number(run.costUsd).toFixed(4)}
              </p>
            ) : null}
            <p className="mt-0.5 font-mono text-[9px] text-ink-faint">{runId}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface2 hover:text-ink"
            aria-label="Close run trace"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading && steps.length === 0 ? (
            <div className="space-y-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-7 w-full" />
              ))}
            </div>
          ) : (
            <RunTrace steps={steps} />
          )}
        </div>
      </div>
    </div>
  );
}
