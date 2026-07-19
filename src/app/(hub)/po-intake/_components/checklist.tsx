"use client";

/**
 * Seven-layer validation checklist (WO-06 task 16). Renders all seven verdicts
 * with expandable detail; on live runs it animates pass/fail sequentially
 * (respecting prefers-reduced-motion). Escalation pins the failing layer open.
 */
import { useEffect, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationLayerResult } from "@/db/schema";

export function Checklist({ validation, animate }: { validation: ValidationLayerResult[]; animate?: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : validation.length);
  const firstFail = validation.find((v) => !v.pass)?.layer ?? null;
  const [open, setOpen] = useState<number | null>(firstFail);

  useEffect(() => {
    if (!animate) return setShown(validation.length);
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setShown(validation.length);
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(i);
      if (i >= validation.length) clearInterval(t);
    }, 220);
    return () => clearInterval(t);
  }, [animate, validation.length]);

  const passed = validation.filter((v) => v.pass).length;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Seven-layer validation</p>
        <span className={cn("font-mono text-[11px]", passed === 7 ? "text-ok" : "text-warn")}>{passed}/7</span>
      </div>
      <ol className="space-y-1">
        {validation.map((v, i) => {
          const visible = i < shown;
          const isOpen = open === v.layer;
          return (
            <li key={v.layer} className={cn("rounded-md border transition-opacity", v.pass ? "border-line" : "border-danger/40", visible ? "opacity-100" : "opacity-0")}>
              <button type="button" onClick={() => setOpen(isOpen ? null : v.layer)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
                <span className="w-5 shrink-0 font-mono text-[10px] text-ink-faint">L{v.layer}</span>
                {v.pass ? <Check className="h-3.5 w-3.5 shrink-0 text-ok" /> : <X className="h-3.5 w-3.5 shrink-0 text-danger" />}
                <span className={cn("flex-1 font-mono text-[11px]", v.pass ? "text-ink" : "text-danger")}>{v.name.replace(/_/g, " ")}</span>
                <span className="font-mono text-[10px] text-ink-faint">{v.durationMs}ms</span>
                <ChevronRight className={cn("h-3 w-3 text-ink-faint transition-transform", isOpen && "rotate-90")} />
              </button>
              {isOpen ? (
                <pre className="mx-2 mb-2 max-h-40 overflow-auto rounded bg-bg p-2 font-mono text-[10px] leading-relaxed text-ink-muted">
                  {JSON.stringify(v.detail, null, 2)}
                </pre>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
