/** Sample order status timeline chips (WO-09 task 7). */
import { cn } from "@/lib/utils";

const STEPS = ["ordered", "shipped", "delivered"] as const;

export function StatusTimeline({ status, orderedAt, shippedAt, deliveredAt }: { status: string; orderedAt: string | null; shippedAt: string | null; deliveredAt: string | null }) {
  const dates: Record<string, string | null> = { ordered: orderedAt, shipped: shippedAt, delivered: deliveredAt };
  const reachedIdx = status === "pending_approval" ? -1 : STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <div className="flex shrink-0 items-center gap-1">
      {status === "pending_approval" ? (
        <span className="rounded-full bg-surface2 px-2 py-0.5 font-mono text-[10px] text-ink-muted">pending approval</span>
      ) : (
        STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px]", i <= reachedIdx ? "bg-ok-dim text-ok" : "bg-surface2 text-ink-faint")} title={dates[s] ? new Date(dates[s]!).toLocaleDateString() : undefined}>
              {s}
            </span>
            {i < STEPS.length - 1 ? <span className="text-[10px] text-ink-faint">→</span> : null}
          </div>
        ))
      )}
    </div>
  );
}
