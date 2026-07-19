"use client";

/**
 * The four film-day actions (WO-13 task 6), each behind a confirm and each
 * hitting an authenticated, audit-logged /api/demo route. Between takes:
 * Reset day → walk the script → Reset day → identical take two.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock, Eye, Loader2, MoonStar, RotateCcw } from "lucide-react";
import { Card, CardHeader, Mono } from "@/components/ui";
import { cn } from "@/lib/utils";

type ActionKey = "reset" | "simulate" | "jump" | "chip";

const ACTIONS: {
  key: ActionKey;
  label: string;
  detail: string;
  endpoint: string;
  icon: typeof RotateCcw;
  confirm?: string;
}[] = [
  {
    key: "reset",
    label: "Reset day",
    detail: "Back to Tue 6:55 AM — Monday batch unprocessed, queue empty, history intact.",
    endpoint: "/api/demo/reset-day",
    icon: RotateCcw,
    confirm: "Reset the film day? All runs, approvals, and takes since seed are wiped.",
  },
  {
    key: "simulate",
    label: "Simulate overnight",
    detail: "Runs the real nightly workflow — triage, fan-out, meetings, brief.",
    endpoint: "/api/demo/simulate-overnight",
    icon: MoonStar,
  },
  {
    key: "jump",
    label: "Jump clock — post-meeting afternoon",
    detail: "Tue 4:15 PM · 9:30 walkthrough completed, transcript + follow-up staged.",
    endpoint: "/api/demo/jump-clock",
    icon: Clock,
    confirm: "Jump to Tue 4:15 PM with the morning meetings completed?",
  },
  {
    key: "chip",
    label: "Toggle DEMO chip",
    detail: "Hide the top-bar clock chip for final footage; bring it back for transparency shots.",
    endpoint: "/api/demo/toggle-chip",
    icon: Eye,
  },
];

export function DemoControlClient() {
  const router = useRouter();
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [log, setLog] = useState<{ key: ActionKey; summary: string; ok: boolean }[]>([]);

  const run = async (action: (typeof ACTIONS)[number]) => {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setBusy(action.key);
    try {
      const res = await fetch(action.endpoint, { method: "POST" });
      const data = (await res.json()) as Record<string, unknown>;
      const summary = res.ok ? summarize(action.key, data) : `failed: ${data.error ?? res.status}`;
      setLog((cur) => [{ key: action.key, summary, ok: res.ok }, ...cur].slice(0, 6));
      router.refresh();
    } catch (err) {
      setLog((cur) => [
        { key: action.key, summary: err instanceof Error ? err.message : "request failed", ok: false },
        ...cur,
      ]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => void run(action)}
            disabled={busy !== null}
            className={cn(
              "rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong",
              busy !== null && "opacity-60",
            )}
          >
            <p className="flex items-center gap-2 text-[13px] font-medium">
              {busy === action.key ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              ) : (
                <action.icon className="h-4 w-4 text-accent" />
              )}
              {action.label}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{action.detail}</p>
          </button>
        ))}
      </div>

      {log.length > 0 ? (
        <Card>
          <CardHeader n="01" title="Action log (this session)" />
          <ul className="space-y-1.5 p-4">
            {log.map((entry, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[12px]">
                <Mono className={cn("shrink-0 text-[10px]", entry.ok ? "text-ok" : "text-danger")}>
                  {entry.ok ? "ok" : "err"}
                </Mono>
                <span className="text-ink-muted">{entry.summary}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function summarize(key: ActionKey, data: Record<string, unknown>): string {
  switch (key) {
    case "reset":
      return `day reset in ${Math.round(Number(data.elapsedMs ?? 0) / 100) / 10}s — Tue 6:55 AM restored`;
    case "simulate": {
      const counts = data.counts as { triaged?: number; drafts?: number; approvalsPending?: number } | undefined;
      return data.status === "noop"
        ? "no-op — the nightly already ran for this demo day (reset first)"
        : `overnight complete — ${counts?.triaged ?? "?"} triaged, ${counts?.drafts ?? "?"} drafts, ${counts?.approvalsPending ?? "?"} approvals pending`;
    }
    case "jump":
      return `clock at Tue 4:15 PM — ${String(data.meetingsCompleted ?? 0)} meetings completed, follow-up ${String(data.followup ?? "staged")}`;
    case "chip":
      return `DEMO chip now ${data.showDemoChip ? "visible" : "hidden"}`;
  }
}
