import { Activity, ArrowRight } from "lucide-react";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { relativeAge } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { overnightChanges } from "@/lib/queries/dashboard";

export async function ChangesFeed() {
  const [changes, demoNow] = await Promise.all([overnightChanges(), getDemoNow()]);
  const shown = changes.slice(0, 8);
  return (
    <Card>
      <CardHeader n="03" title="Overnight Changes" />
      {changes.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No changes yet"
          copy="Overnight changes appear here after the agents run — per-account deltas from yesterday's emails and meetings."
        />
      ) : (
        <div className="divide-y divide-line">
          {shown.map((a) => (
            <div key={a.accountId} className="px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-medium">{a.accountName}</span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {relativeAge(a.items[0]!.occurredAt, demoNow)}
                </span>
              </div>
              <ul className="space-y-1.5">
                {a.items.map((item) => (
                  <li key={item.id} className="text-[12px] leading-snug text-ink-muted">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.isNew ? <StatusPill tone="ok">NEW</StatusPill> : null}
                      <span>{item.summary}</span>
                    </div>
                    {item.diffs
                      .filter((d) => d.field !== "__create__")
                      .map((d, i) => (
                        <div key={i} className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-ink-faint">{d.field}:</span>
                          <span className="text-ink-faint line-through">{String(d.old ?? "—")}</span>
                          <ArrowRight className="h-3 w-3 text-ink-faint" />
                          <span className="text-ink">{String(d.new ?? "—")}</span>
                        </div>
                      ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {changes.length > 8 ? (
            <details className="px-4 py-2">
              <summary className="cursor-pointer text-[11px] text-ink-muted hover:text-ink">
                Show all {changes.length} accounts
              </summary>
              <div className="mt-2 space-y-2">
                {changes.slice(8).map((a) => (
                  <div key={a.accountId} className="text-[12px] text-ink-muted">
                    <span className="font-medium text-ink">{a.accountName}</span> — {a.items.length} change(s)
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </Card>
  );
}
