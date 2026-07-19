/**
 * Overnight banner (WO-02 task 4). Reads the latest nightly morning-brief run
 * and states exactly what ran overnight, then CTAs into the approval queue —
 * the entry point of the 2-hours-to-10-minutes montage. `approvalsPending` is
 * the LIVE pending count, not the frozen brief figure. No brief yet → a
 * designed empty state, never a blank card.
 */
import Link from "next/link";
import { ArrowRight, Moon, Sparkles } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { formatDurationMs, formatTimeShort } from "@/lib/dates";
import { overnightSummary } from "@/lib/queries/dashboard";
import { SimulateOvernightButton } from "./simulate-button";

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div className="font-mono text-lg tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  );
}

export async function OvernightBanner() {
  const s = await overnightSummary();

  if (!s) {
    return (
      <Card className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-line bg-surface2 p-2">
            <Moon className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-medium">No overnight run yet</p>
            <p className="mt-0.5 text-xs text-ink-muted">Agents run at 5:00 AM — or run the night now.</p>
          </div>
        </div>
        <SimulateOvernightButton />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-accent/30 bg-accent-dim p-2">
            <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium">Overnight brief</p>
              {s.finishedAt ? (
                <span className="font-mono text-[10px] text-ink-faint">
                  finished {formatTimeShort(s.finishedAt)} · {formatDurationMs(s.elapsedMs)}
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-muted">
              Agents triaged {s.triaged} emails and drafted {s.drafts} replies overnight.{" "}
              {s.approvalsPending > 0
                ? `${s.approvalsPending} approval${s.approvalsPending === 1 ? "" : "s"} waiting — the queue clears in about ten minutes.`
                : "Drafts only — humans send."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 md:gap-8">
          <Stat value={s.triaged} label="triaged" />
          <Stat value={s.drafts} label="drafts" />
          <Stat value={s.approvalsPending} label="pending" />
          <Link href="/approvals">
            <Button variant="primary" className="whitespace-nowrap">
              Review approvals <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
