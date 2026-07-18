"use client";

/**
 * "Why can't agents send email?" popover (WO-03 task 13) — the trifecta-
 * separation selling point, in customer-friendly language. Copy is verbatim
 * from the WO. Shown in the queue header and on every email_draft card.
 */
import { useState } from "react";
import { HelpCircle } from "lucide-react";

export function WhyPopover({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-muted transition-colors hover:text-ink"
        aria-expanded={open}
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
        {compact ? null : "Why can't agents send email?"}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-80 rounded-md border border-line bg-surface p-3 text-left shadow-xl">
          <p className="mb-1.5 text-[12px] font-semibold">Why can&rsquo;t agents send email?</p>
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Our agents read untrusted content — inbound mail, attached PDFs, meeting recordings. Anything that reads
            untrusted content can be lied to, so no such agent is ever given the power to act on the outside world. Tools
            that would send, order, or commit are structurally disabled: calling one creates a proposal in this queue
            instead. The send happens only after you approve — executed by deterministic code that re-checks recipients,
            rate limits, and attachment origin. <span className="font-medium text-ink">Drafts only — humans send.</span>{" "}
            That isn&rsquo;t a policy we ask the model to follow; it&rsquo;s how the system is built.
          </p>
        </div>
      ) : null}
    </span>
  );
}
