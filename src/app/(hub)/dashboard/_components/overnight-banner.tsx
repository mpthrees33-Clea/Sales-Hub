import Link from "next/link";
import { ArrowRight, MoonStar } from "lucide-react";
import { Card } from "@/components/ui";
import { formatDurationMs, formatTimeShort } from "@/lib/dates";
import { overnightSummary } from "@/lib/queries/dashboard";
import { SimulateOvernightButton } from "./simulate-button";

export async function OvernightBanner() {
  const s = await overnightSummary();

  if (!s) {
    return (
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-line bg-surface2 p-2">
            <MoonStar className="h-4 w-4 text-ink-muted" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium">No overnight run yet — agents run at 5:00 AM</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Overnight, agents triage the inbox, draft replies and quotes, process POs, and update the pipeline.
              Everything lands in Approvals. Drafts only — humans send.
            </p>
          </div>
        </div>
        <SimulateOvernightButton />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-line bg-accent-dim p-2">
          <MoonStar className="h-4 w-4 text-accent" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium">
            Overnight: {s.triaged} emails triaged ({s.archived} archived) · {s.drafts} drafts ready ·{" "}
            {s.approvalsPending} approvals pending
          </p>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-muted">
            {s.narrative ?? "The nightly run finished."}{" "}
            <span className="font-mono text-[10px] text-ink-faint">
              finished {formatTimeShort(s.finishedAt)} · {formatDurationMs(s.elapsedMs)}
            </span>
          </p>
        </div>
      </div>
      <Link
        href="/approvals"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90"
      >
        Review approvals <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}
