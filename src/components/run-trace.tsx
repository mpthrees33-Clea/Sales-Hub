"use client";

/**
 * <RunTrace /> — timeline of agent_steps ("watch the harness think",
 * docs/03 §3). LLM calls, tool calls (name + ms), validations (pass/fail),
 * escalations; collapsible detail; monospace; semantic colors. Contract
 * {steps: StepRow[]} fixed in WO-01 and reused verbatim by WO-02/03/06.
 */
import { useState } from "react";
import { AlertTriangle, Brain, ChevronRight, ShieldCheck, Wrench, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepRow = {
  id: string;
  seq: number;
  kind: "llm_call" | "tool_call" | "validation" | "escalation" | "workflow_step";
  name: string;
  input: unknown;
  output: unknown;
  durationMs: number;
};

const KIND_META = {
  llm_call: { icon: Brain, cls: "text-accent" },
  tool_call: { icon: Wrench, cls: "text-ink-muted" },
  validation: { icon: ShieldCheck, cls: "text-ok" },
  escalation: { icon: AlertTriangle, cls: "text-warn" },
  workflow_step: { icon: GitBranch, cls: "text-ink-muted" },
} as const;

export function RunTrace({ steps }: { steps: StepRow[] }) {
  if (steps.length === 0) {
    return <p className="px-1 py-3 font-mono text-[11px] text-ink-faint">No steps recorded yet.</p>;
  }
  return (
    <ol className="space-y-0.5">
      {steps.map((s) => (
        <TraceRow key={s.id} step={s} />
      ))}
    </ol>
  );
}

function validationFailed(s: StepRow): boolean {
  return s.kind === "validation" && typeof s.output === "object" && s.output !== null && (s.output as { pass?: boolean }).pass === false;
}

function TraceRow({ step }: { step: StepRow }) {
  const [open, setOpen] = useState(false);
  const failed = validationFailed(step);
  const meta = KIND_META[step.kind];
  const Icon = failed ? AlertTriangle : meta.icon;
  const hasDetail = step.input != null || step.output != null;
  return (
    <li className="rounded-md border border-transparent hover:border-line">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        <span className="w-6 shrink-0 text-right font-mono text-[10px] text-ink-faint">{step.seq}</span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", failed ? "text-danger" : meta.cls)} strokeWidth={1.75} />
        <span className={cn("flex-1 truncate font-mono text-[11px]", failed ? "text-danger" : "text-ink")}>
          {step.name}
          {failed ? " · FAIL" : ""}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-ink-faint">{step.durationMs}ms</span>
        {hasDetail ? (
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 text-ink-faint transition-transform", open && "rotate-90")}
          />
        ) : null}
      </button>
      {open && hasDetail ? (
        <div className="mx-2 mb-2 space-y-1.5 rounded-md bg-bg p-2">
          {step.input != null ? <TracePayload label="input" value={step.input} /> : null}
          {step.output != null ? <TracePayload label="output" value={step.output} /> : null}
        </div>
      ) : null}
    </li>
  );
}

function TracePayload({ label, value }: { label: string; value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <div>
      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{label}</span>
      <pre className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-ink-muted">
        {text.length > 2400 ? text.slice(0, 2400) + "\n…" : text}
      </pre>
    </div>
  );
}
