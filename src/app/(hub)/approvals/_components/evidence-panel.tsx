"use client";

/**
 * Evidence source panel (WO-03 task 5): right-side sheet (bottom sheet at
 * phone width) rendering the referenced source per type — email view, PDF
 * page with highlight, price row, transcript segment, inventory snapshot.
 * Every panel shows the evidence quote and a monospace ref.
 */
import Link from "next/link";
import { X } from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer";
import { Mono } from "@/components/ui";
import { formatCentsExact } from "@/lib/money";
import type { ResolvedEvidence } from "@/lib/queries/approvals";

export function EvidencePanel({ item, onClose }: { item: ResolvedEvidence; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative flex max-h-[85vh] w-full flex-col rounded-t-xl border border-line bg-surface sm:h-full sm:max-h-none sm:w-[480px] sm:rounded-none sm:border-l">
        <header className="flex items-start justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Source · {item.type.replace("_", " ")}</h3>
            <p className="mt-0.5 truncate font-mono text-[10px] text-ink-faint">{JSON.stringify(item.ref)}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1.5 hover:bg-surface2">
            <X className="h-4 w-4 text-ink-muted" />
          </button>
        </header>
        {item.quote ? (
          <div className="border-b border-line bg-surface2 px-4 py-2">
            <p className="text-[11px] italic text-ink-muted">&ldquo;{item.quote}&rdquo;</p>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto p-4">
          <PanelBody item={item} />
        </div>
      </aside>
    </div>
  );
}

function PanelBody({ item }: { item: ResolvedEvidence }) {
  const r = item.resolved;
  if (!r) {
    return <p className="text-xs text-ink-muted">Source data unavailable — the referenced row may have been reset.</p>;
  }
  switch (r.kind) {
    case "email":
      return (
        <div className="rounded-md border border-line bg-bg">
          <div className="space-y-1 border-b border-line px-3 py-2 text-[12px]">
            <p className="font-medium text-ink">{r.subject}</p>
            <p className="font-mono text-[11px] text-ink-muted">from {r.from}</p>
            <p className="font-mono text-[10px] text-ink-faint">{new Date(r.receivedAt).toLocaleString()}</p>
          </div>
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap px-3 py-3 font-mono text-[12px] leading-relaxed">
            {r.bodyText}
          </div>
        </div>
      );
    case "pdf_page":
      return <PdfViewer url={r.blobUrl} highlight={{ page: r.page, bbox: r.bbox }} />;
    case "price_row":
      return (
        <dl className="space-y-2">
          <PanelRow k="SKU" v={<Mono>{r.sku}</Mono>} />
          <PanelRow k="Price list" v={`${r.priceListName} (${r.tier} tier)`} />
          <PanelRow k="Unit price" v={<Mono>{formatCentsExact(r.unitPriceCents)}</Mono>} />
          <PanelRow k="Min qty" v={String(r.minQty)} />
        </dl>
      );
    case "transcript_segment":
      return (
        <div className="space-y-3">
          <div className="rounded-md border border-line bg-bg p-3">
            <p className="font-mono text-[10px] text-ink-faint">
              {r.speaker} · {Math.floor(r.t0 / 60)}:{String(Math.floor(r.t0 % 60)).padStart(2, "0")}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed">{r.text}</p>
          </div>
          <Link
            href={`/meetings?goto=${r.meetingId}&seg=${r.segmentIndex}`}
            className="text-[12px] text-accent hover:opacity-80"
          >
            Open in transcript →
          </Link>
        </div>
      );
    case "inventory_row":
      return (
        <dl className="space-y-2">
          <PanelRow k="SKU" v={<Mono>{r.sku}</Mono>} />
          <PanelRow k="On hand" v={String(r.onHand)} />
          <PanelRow k="Allocated" v={String(r.allocated)} />
          <PanelRow k="Available" v={<span className={r.available < 10 ? "text-warn" : "text-ok"}>{r.available}</span>} />
          <PanelRow k="Lead time" v={`${r.leadTimeDays} days`} />
        </dl>
      );
  }
}

function PanelRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-2 text-[13px]">
      <dt className="text-ink-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
