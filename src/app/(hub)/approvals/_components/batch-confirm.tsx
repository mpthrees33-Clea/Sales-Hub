"use client";

/** Batch-approve confirm dialog (WO-03 task 11). Low-tier only; lists count + kinds. */
import { X } from "lucide-react";
import { Button } from "@/components/ui";

export function BatchConfirm({
  count,
  kinds,
  busy,
  onConfirm,
  onCancel,
}: {
  count: number;
  kinds: string[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm batch approve">
      <button type="button" aria-label="Close" onClick={onCancel} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm rounded-lg border border-line bg-surface p-4 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-medium">Approve {count} low-tier item{count === 1 ? "" : "s"}?</h2>
          <button type="button" onClick={onCancel} className="rounded p-1 text-ink-muted hover:bg-surface2 hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[11px] text-ink-muted">
          {kinds.join(", ")}. The policy gate re-runs on each item; a block on one won&rsquo;t stop the rest.
        </p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={onConfirm} disabled={busy}>
            Approve {count}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
