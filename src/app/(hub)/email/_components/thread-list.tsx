"use client";

/** Thread list — middle pane (docs/03 §5, WO-04 task 8). */
import { cn } from "@/lib/utils";
import type { ThreadRow } from "@/lib/queries/email";
import { TriagePill } from "./triage-pill";
import { DraftReadyChip } from "./draft-ready-chip";

function age(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function ThreadList({
  threads,
  selectedId,
  onSelect,
  now,
}: {
  threads: ThreadRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: Date;
}) {
  if (threads.length === 0) {
    return <p className="px-4 py-12 text-center text-[12px] text-ink-muted">No threads in this view.</p>;
  }
  return (
    <div className="divide-y divide-line">
      {threads.map((t) => {
        const active = t.id === selectedId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              "block w-full px-3 py-2.5 text-left transition-colors",
              active ? "bg-accent-dim border-l-2 border-l-accent" : "border-l-2 border-l-transparent hover:bg-surface2",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-medium">{t.subject}</span>
              <span className="shrink-0 font-mono text-[10px] text-ink-faint">{age(t.lastMessageAt, now)}</span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] text-ink-faint">
              {t.latestDirection === "outbound" ? "→ " : ""}
              {t.latestFrom}
            </p>
            <p className="mt-1 line-clamp-1 text-[11px] text-ink-muted">{t.snippet}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <TriagePill category={t.triage} confidence={t.triageConfidence} />
              {t.status === "needs_review" ? <span className="font-mono text-[9px] text-warn">needs review</span> : null}
              {t.draftApprovalId ? <DraftReadyChip approvalId={t.draftApprovalId} /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
