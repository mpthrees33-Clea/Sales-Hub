"use client";

/**
 * Evidence source panel (WO-03 task 5) — "Every answer shows its source". Opens
 * from an evidence chip (click or `enter`) as a right-side sheet on desktop, a
 * bottom sheet at phone width. Renders per evidence type: email view, PDF page
 * with highlight, price row, transcript segment, inventory snapshot. Always
 * shows the evidence quote and a monospace ref id.
 */
import { X } from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer";
import { formatCentsExact } from "@/lib/money";
import type { ResolvedEvidence } from "@/lib/queries/approvals";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="text-right text-[12px] text-ink">{value}</span>
    </div>
  );
}

function Body({ evidence }: { evidence: ResolvedEvidence }) {
  const s = evidence.source;
  switch (s.kind) {
    case "email":
      return (
        <div>
          <div className="mb-3">
            <p className="text-[13px] font-medium">{s.subject}</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{s.from}</p>
            <p className="font-mono text-[10px] text-ink-faint">{new Date(s.receivedAt).toLocaleString()}</p>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-ink-muted">{s.bodyText}</pre>
        </div>
      );
    case "pdf":
      return s.blobUrl ? (
        <PdfViewer blobUrl={s.blobUrl} page={s.page} bbox={s.bbox} />
      ) : (
        <p className="text-[12px] text-ink-muted">Referenced document is unavailable.</p>
      );
    case "price_row":
      return (
        <div>
          <Field label="SKU" value={<span className="font-mono">{s.sku}</span>} />
          <Field label="Price list" value={s.priceListName} />
          <Field label="Tier" value={s.tier} />
          <Field label="Unit price" value={<span className="font-mono">{formatCentsExact(s.unitPriceCents)}</span>} />
          <Field label="Min qty" value={s.minQty} />
        </div>
      );
    case "transcript":
      return (
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {s.speaker} · {Math.floor(s.t0)}s–{Math.floor(s.t1)}s
          </p>
          <p className="text-[13px] leading-relaxed text-ink">&ldquo;{s.text}&rdquo;</p>
        </div>
      );
    case "inventory":
      return (
        <div>
          <Field label="SKU" value={<span className="font-mono">{s.sku}</span>} />
          <Field label="On hand" value={s.onHand} />
          <Field label="Allocated" value={s.allocated} />
          <Field label="Available" value={s.onHand - s.allocated} />
          <Field label="Lead time" value={`${s.leadTimeDays} days`} />
        </div>
      );
    case "unknown":
      return <p className="text-[12px] text-ink-muted">Source could not be resolved.</p>;
  }
}

export function EvidencePanel({ evidence, onClose }: { evidence: ResolvedEvidence; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label="Evidence source">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-xl border border-line bg-surface shadow-xl sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-xl sm:border-l">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{evidence.type.replace("_", " ")}</span>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-surface2 hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Body evidence={evidence} />
        </div>
        <div className="border-t border-line px-4 py-2.5">
          {evidence.quote ? <p className="text-[11px] italic text-ink-muted">&ldquo;{evidence.quote}&rdquo;</p> : null}
          <p className="mt-1 font-mono text-[9px] text-ink-faint">{evidence.refId}</p>
        </div>
      </div>
    </div>
  );
}
