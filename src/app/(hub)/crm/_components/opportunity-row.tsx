"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { STAGE_LABEL, STAGE_ORDER, type Stage } from "@/lib/crm-stages";
import { formatCents } from "@/lib/money";
import { updateOpportunity } from "../actions";
import { StageBadge } from "./stage-badge";

type Opp = { id: string; name: string; stage: Stage; valueCents: number; probability: number; nextStep: string | null };

export function OpportunityRow({ opp }: { opp: Opp }) {
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState<Stage>(opp.stage);
  const [dollars, setDollars] = useState(String(Math.round(opp.valueCents / 100)));
  const [nextStep, setNextStep] = useState(opp.nextStep ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateOpportunity({
        id: opp.id,
        stage,
        valueCents: Math.round(Number(dollars) || 0) * 100,
        nextStep,
      });
      if (res.ok) setEditing(false);
      else setErr(res.error);
    });
  }

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px]">{opp.name}</p>
          {opp.nextStep ? <p className="mt-0.5 font-mono text-[10px] text-ink-faint">next: {opp.nextStep}</p> : null}
        </div>
        <StageBadge stage={opp.stage} />
        <span className="font-mono text-[11px] text-ink-muted">{formatCents(opp.valueCents)}</span>
        <span className="w-8 text-right font-mono text-[10px] text-ink-faint">{opp.probability}%</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit opportunity"
          className="rounded-md p-1 text-ink-faint hover:bg-surface2 hover:text-ink"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-2 bg-surface2/40 px-4 py-3">
      <span className="min-w-0 flex-1 text-[13px]">{opp.name}</span>
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value as Stage)}
        className="rounded border border-line bg-surface px-1.5 py-1 font-mono text-[12px] outline-none focus:border-accent"
      >
        {STAGE_ORDER.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </select>
      <span className="font-mono text-[11px] text-ink-faint">$</span>
      <input
        value={dollars}
        onChange={(e) => setDollars(e.target.value)}
        inputMode="numeric"
        aria-label="Value in dollars"
        className="w-24 rounded border border-line bg-surface px-1.5 py-1 font-mono text-[12px] outline-none focus:border-accent"
      />
      <input
        value={nextStep}
        onChange={(e) => setNextStep(e.target.value)}
        placeholder="next step"
        aria-label="Next step"
        className="w-40 rounded border border-line bg-surface px-1.5 py-1 text-[12px] outline-none focus:border-accent"
      />
      <button type="button" onClick={save} disabled={pending} aria-label="Save" className="rounded-md p-1 text-ok hover:bg-surface2 disabled:opacity-50">
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setErr(null);
        }}
        aria-label="Cancel"
        className="rounded-md p-1 text-ink-faint hover:bg-surface2"
      >
        <X className="h-4 w-4" />
      </button>
      {err ? <span className="w-full font-mono text-[10px] text-danger">{err}</span> : null}
    </li>
  );
}
