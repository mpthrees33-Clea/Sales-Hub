"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

/** The trifecta-separation selling point (WO-03 task 13 — copy verbatim). */
export function WhyPopover() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-faint transition-colors hover:text-ink-muted"
      >
        <Info className="h-3 w-3" />
        Why can&apos;t agents send email?
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 hover:bg-surface2"
            >
              <X className="h-4 w-4 text-ink-muted" />
            </button>
            <h3 className="text-sm font-semibold">Why can&apos;t agents send email?</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
              Our agents read untrusted content — inbound mail, attached PDFs, meeting recordings. Anything that reads
              untrusted content can be lied to, so no such agent is ever given the power to act on the outside world.
              Tools that would send, order, or commit are structurally disabled: calling one creates a proposal in this
              queue instead. The send happens only after you approve — executed by deterministic code that re-checks
              recipients, rate limits, and attachment origin.{" "}
              <strong className="text-ink">Drafts only — humans send.</strong> That isn&apos;t a policy we ask the
              model to follow; it&apos;s how the system is built.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
