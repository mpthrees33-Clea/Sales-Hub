import { Car } from "lucide-react";
import { formatTimeShort } from "@/lib/dates";

/**
 * Leave-by chip. Contract: {leaveBy?: Date, tight?: boolean, tooltip?: string}.
 * WO-12 populates values via MapsProvider route math; the em-dash shell
 * renders until a route is computed.
 */
export function LeaveByChip({ leaveBy, tight, tooltip }: { leaveBy?: Date; tight?: boolean; tooltip?: string }) {
  if (!leaveBy) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface2 px-2 py-1 font-mono text-[10px] text-ink-faint"
        title={tooltip ?? "Route timing computes with the day's route"}
      >
        <Car className="h-3 w-3" strokeWidth={1.75} />
        leave by —
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] ${
        tight ? "bg-warn-dim text-warn" : "bg-accent-dim text-accent"
      }`}
      title={tooltip}
    >
      <Car className="h-3 w-3" strokeWidth={1.75} />
      leave by {formatTimeShort(leaveBy)}
      {tight ? " · tight" : ""}
    </span>
  );
}
