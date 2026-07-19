"use client";

/**
 * Evidence chips ("Every answer shows its source", docs/03 §3). One chip per
 * evidence item; icon by type; click opens the source panel (WO-03 supplies
 * the panel via onOpen). Contract fixed in WO-01.
 */
import { FileText, Mail, Mic, Package, Palette, Table2 } from "lucide-react";
import type { Evidence } from "@/db/schema";

const ICONS = {
  email: Mail,
  pdf_page: FileText,
  price_row: Table2,
  transcript_segment: Mic,
  inventory_row: Package,
  product: Palette,
} as const;

const LABELS = {
  email: "email",
  pdf_page: "PDF",
  price_row: "price row",
  transcript_segment: "transcript",
  inventory_row: "inventory",
  product: "product",
} as const;

export function EvidenceChips({
  evidence,
  onOpen,
}: {
  evidence: Evidence[];
  onOpen?: (item: Evidence, index: number) => void;
}) {
  if (evidence.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {evidence.map((e, i) => {
        const Icon = ICONS[e.type];
        const label = LABELS[e.type];
        return (
          <button
            key={i}
            type="button"
            onClick={() => onOpen?.(e, i)}
            className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-line bg-surface2 px-2 py-1 font-mono text-[10px] text-ink-muted transition-colors hover:border-accent hover:text-ink"
            title={e.quote}
          >
            <Icon className="h-3 w-3 shrink-0" strokeWidth={1.75} />
            <span className="truncate">
              {label}
              {e.quote ? ` · ${e.quote}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
