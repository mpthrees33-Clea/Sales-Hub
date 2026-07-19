"use client";

/** Film-day control panel (WO-13 task 6) — each action confirms, runs, and reports. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Eye, EyeOff, Loader2, Moon, RotateCcw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { jumpClockAction, resetDayAction, simulateOvernightAction, toggleChipAction } from "./actions";

type Result = { label: string; text: string } | null;

export function DemoControlPanel({ clockLabel, showChip }: { clockLabel: string; showChip: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [chip, setChip] = useState(showChip);

  const run = (key: string, fn: () => Promise<Result>, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(key);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await fn());
      } finally {
        setBusy(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Demo Control</h1>
        <span className="font-mono text-[11px] text-ink-faint">DEMO • {clockLabel}</span>
      </div>
      <p className="font-mono text-[10px] text-ink-faint">Hidden, authenticated, audit-logged. Determinism is the brand: reset → simulate → identical counts, every take.</p>

      <Card>
        <CardHeader title="Film-day actions" />
        <div className="divide-y divide-line">
          <Row
            icon={RotateCcw}
            title="Reset day"
            copy="Restore the exact Tue 6:55 AM state (8-week history intact). Clears prior-take runs, approvals, POs."
            busy={busy === "reset"}
            disabled={pending}
            onClick={() => run("reset", async () => { await resetDayAction(); return { label: "Reset day", text: "Restored Tue 6:55 AM." }; }, "Reset the demo day? This clears all prior-take runs, approvals, and POs.")}
          />
          <Row
            icon={Moon}
            title="Simulate overnight"
            copy="Run the real nightly workflow — 14 triaged, 6 drafts, 1 escalated PO, 1 brief."
            busy={busy === "sim"}
            disabled={pending}
            onClick={() => run("sim", async () => { const r = await simulateOvernightAction(); return { label: "Simulate overnight", text: r.note ?? `Triaged ${r.triaged}, processed ${r.processed}.` }; })}
          />
          <Row
            icon={Clock}
            title="Jump clock → post-meeting afternoon"
            copy="Advance to Tue 4:15 PM with the 9:30 meeting completed, so beat 5 films without waiting."
            busy={busy === "jump"}
            disabled={pending}
            onClick={() => run("jump", async () => { const r = await jumpClockAction(); return { label: "Jump clock", text: `Now ${new Date(r.demoNow).toISOString()}.` }; })}
          />
          <Row
            icon={chip ? EyeOff : Eye}
            title={chip ? "Hide DEMO chip" : "Show DEMO chip"}
            copy="Toggle the top-bar DEMO chip for clean filming takes (persisted)."
            busy={busy === "chip"}
            disabled={pending}
            onClick={() => run("chip", async () => { const r = await toggleChipAction(); setChip(r.showDemoChip); return { label: "DEMO chip", text: r.showDemoChip ? "Chip visible." : "Chip hidden." }; })}
          />
        </div>
      </Card>

      {result ? (
        <Card className="p-3">
          <span className="font-mono text-[11px] text-ok">✓ {result.label}: {result.text}</span>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ icon: Icon, title, copy, onClick, busy, disabled }: { icon: React.ComponentType<{ className?: string }>; title: string; copy: string; onClick: () => void; busy: boolean; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
        <div className="min-w-0">
          <div className="text-[13px] font-medium">{title}</div>
          <div className="text-[11px] text-ink-muted">{copy}</div>
        </div>
      </div>
      <button type="button" onClick={onClick} disabled={disabled} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface2 px-3 py-1.5 text-[12px] font-medium hover:border-line-strong disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Run
      </button>
    </div>
  );
}
