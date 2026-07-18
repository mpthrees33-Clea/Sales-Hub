/**
 * Overnight Changes feed (WO-02 task 7) — Rox-style per-account opportunity
 * deltas the agents produced overnight, rendered as compact old → new pairs.
 * The default seed produces none (designed empty state); `--with-overnight`
 * seeds two. Capped at 8 accounts with a "show all" expander.
 */
import { GitCompareArrows } from "lucide-react";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { overnightChanges, type FieldDiff } from "@/lib/queries/dashboard";

const CAP = 8;

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function DiffRow({ diff }: { diff: FieldDiff }) {
  return (
    <div className="flex flex-wrap items-baseline gap-1.5 text-[11px]">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{diff.field}</span>
      <span className="text-ink-muted line-through decoration-danger/50">{fmt(diff.old)}</span>
      <span className="text-ink-faint">→</span>
      <span className="text-ink">{fmt(diff.new)}</span>
    </div>
  );
}

export async function ChangesFeed() {
  const changes = await overnightChanges();

  return (
    <Card>
      <CardHeader
        title="Overnight Changes"
        n="05"
        right={changes.length > 0 ? <span className="font-mono text-[10px] text-ink-faint">{changes.length} accounts</span> : undefined}
      />
      {changes.length === 0 ? (
        <EmptyState
          icon={GitCompareArrows}
          title="No overnight changes"
          copy="Opportunity updates the agents make overnight appear here, grouped by account with field-level diffs."
        />
      ) : (
        <ul className="divide-y divide-line">
          {changes.slice(0, CAP).map((c) => (
            <li key={c.accountId} className="px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[13px] font-medium">{c.accountName}</span>
                {c.items.some((i) => i.isNew) ? <StatusPill tone="accent">NEW</StatusPill> : null}
              </div>
              <ul className="space-y-2">
                {c.items.map((it) => (
                  <li key={it.id} className="border-l border-line pl-3">
                    <p className="text-[11px] text-ink-muted">
                      {it.opportunityName ? <span className="text-ink">{it.opportunityName}</span> : null}
                      {it.opportunityName ? " · " : ""}
                      {it.summary}
                    </p>
                    {it.diffs.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {it.diffs.map((d, i) => (
                          <DiffRow key={i} diff={d} />
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {changes.length > CAP ? (
            <li className="px-4 py-2 font-mono text-[10px] text-ink-faint">+{changes.length - CAP} more accounts</li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}

export function ChangesFeedSkeleton() {
  return (
    <Card>
      <CardHeader title="Overnight Changes" n="05" />
      <div className="space-y-3 p-4">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton h-3.5 w-32" />
            <div className="skeleton h-3 w-48" />
          </div>
        ))}
      </div>
    </Card>
  );
}
