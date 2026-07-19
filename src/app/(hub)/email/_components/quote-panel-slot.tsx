/**
 * Quote panel slot (WO-04 task 8) — an intentionally-empty region in the thread
 * view that WO-05 fills with the live quote agent. Rendered only for
 * quote-target threads so the seam is visible.
 */
import { Receipt } from "lucide-react";

export function QuotePanelSlot({ threadId }: { threadId: string }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface2/30 p-3" data-thread-id={threadId}>
      <div className="flex items-center gap-2 text-[12px] text-ink-muted">
        <Receipt className="h-3.5 w-3.5" />
        Quote agent panel — lands in WO-05
      </div>
      <p className="mt-1 font-mono text-[10px] text-ink-faint">
        This thread is routed <span className="text-accent">quote</span>; the quote agent will draft stock-checked, priced lines here.
      </p>
    </div>
  );
}
