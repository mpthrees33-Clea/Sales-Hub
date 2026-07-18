"use client";

/** Shared bits for the structured approval cards (quote / sales_order). */
import { Check, X } from "lucide-react";
import { formatCentsExact } from "@/lib/money";

export type Line = {
  sku?: string;
  description?: string;
  qty?: number;
  uom?: string;
  unitPriceCents?: number;
  extendedCents?: number;
  sourceRowId?: string;
};

export type ValidationLayer = { layer: number; name: string; pass: boolean; detail?: Record<string, unknown> };

/** Recompute per-line extended + subtotal/total after an edit. */
export function recalcTotals(draft: Record<string, unknown>): void {
  const lines = (draft.lines as Line[]) ?? [];
  let subtotal = 0;
  for (const l of lines) {
    l.extendedCents = (l.qty ?? 0) * (l.unitPriceCents ?? 0);
    subtotal += l.extendedCents;
  }
  draft.subtotalCents = subtotal;
  draft.totalCents = subtotal;
}

export function LinesTable({
  lines,
  editing,
  onEditLine,
  showProvenance,
}: {
  lines: Line[];
  editing: boolean;
  onEditLine?: (index: number, patch: Partial<Line>) => void;
  showProvenance?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line bg-surface2/50 text-left font-mono text-[9px] uppercase tracking-wider text-ink-faint">
            <th className="px-2 py-1.5">SKU</th>
            <th className="px-2 py-1.5">Description</th>
            <th className="px-2 py-1.5 text-right">Qty</th>
            <th className="px-2 py-1.5">UOM</th>
            <th className="px-2 py-1.5 text-right">Unit</th>
            <th className="px-2 py-1.5 text-right">Extended</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5 font-mono text-[11px]">{l.sku}</td>
              <td className="px-2 py-1.5 text-ink-muted">
                {l.description}
                {showProvenance && l.sourceRowId ? (
                  <span className="ml-1 font-mono text-[9px] text-ink-faint" title="price_list_items provenance">
                    · src {l.sourceRowId.slice(0, 6)}
                  </span>
                ) : null}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                {editing ? (
                  <input
                    type="number"
                    className="w-14 rounded border border-line bg-surface2 px-1 py-0.5 text-right"
                    value={l.qty ?? 0}
                    onChange={(e) => onEditLine?.(i, { qty: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    aria-label={`qty ${l.sku}`}
                  />
                ) : (
                  l.qty
                )}
              </td>
              <td className="px-2 py-1.5 text-ink-faint">{l.uom}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                {editing ? (
                  <input
                    type="number"
                    className="w-20 rounded border border-line bg-surface2 px-1 py-0.5 text-right"
                    value={((l.unitPriceCents ?? 0) / 100).toFixed(2)}
                    onChange={(e) => onEditLine?.(i, { unitPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                    aria-label={`unit price ${l.sku}`}
                  />
                ) : (
                  formatCentsExact(l.unitPriceCents ?? 0)
                )}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{formatCentsExact(l.extendedCents ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ValidationChecklist({ layers }: { layers: ValidationLayer[] }) {
  if (!layers?.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Validation · {layers.filter((l) => l.pass).length}/{layers.length}</p>
      <ul className="space-y-1">
        {layers.map((l) => (
          <li key={l.layer} className="flex items-center gap-2 text-[11px]">
            {l.pass ? <Check className="h-3.5 w-3.5 shrink-0 text-ok" /> : <X className="h-3.5 w-3.5 shrink-0 text-danger" />}
            <span className={l.pass ? "text-ink-muted" : "text-danger"}>
              <span className="font-mono text-[10px] text-ink-faint">L{l.layer}</span> {l.name.replace(/_/g, " ")}
              {!l.pass && l.detail?.message ? ` — ${String(l.detail.message)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Totals({ subtotalCents, totalCents }: { subtotalCents?: number; totalCents?: number }) {
  return (
    <div className="mt-2 flex justify-end gap-6 font-mono text-[12px]">
      <span className="text-ink-faint">Subtotal {formatCentsExact(subtotalCents ?? 0)}</span>
      <span className="font-medium text-ink">Total {formatCentsExact(totalCents ?? 0)}</span>
    </div>
  );
}
