"use client";

/**
 * Inline edit path (WO-03 task 7) — never a modal round-trip. email_draft
 * uses the full <DraftEditor />; structured kinds get field-level inline
 * editors; anything else edits as validated JSON.
 */
import { useState } from "react";
import { DraftEditor, type AssetOption, type DraftValue } from "@/components/draft-editor";
import { formatCentsExact } from "@/lib/money";

export function EditBody({
  kind,
  payload,
  onChange,
  assetOptions,
}: {
  kind: string;
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
  assetOptions: AssetOption[];
}) {
  if (kind === "email_draft" || kind === "scene_send") {
    const value: DraftValue = {
      to: (payload.to ?? []) as string[],
      cc: (payload.cc ?? []) as string[],
      subject: String(payload.subject ?? ""),
      bodyText: String(payload.bodyText ?? payload.body_markdown ?? ""),
      attachmentAssetIds: (payload.attachmentAssetIds ?? payload.attachment_pds_ids ?? []) as string[],
    };
    return (
      <DraftEditor
        value={value}
        assetOptions={assetOptions}
        onChange={(v) =>
          onChange({
            ...payload,
            to: v.to,
            cc: v.cc,
            subject: v.subject,
            bodyText: v.bodyText,
            attachmentAssetIds: v.attachmentAssetIds,
            ...(payload.attachment_pds_ids ? { attachment_pds_ids: v.attachmentAssetIds } : {}),
          })
        }
      />
    );
  }

  if ((kind === "quote" || kind === "sales_order") && Array.isArray(payload.lines)) {
    return <LinesEditor payload={payload} onChange={onChange} />;
  }

  if (kind === "opportunity_update" && Array.isArray(payload.fieldDiffs)) {
    return <DiffsEditor payload={payload} onChange={onChange} />;
  }

  if (kind === "sample_order" && Array.isArray(payload.items)) {
    return <SampleItemsEditor payload={payload} onChange={onChange} />;
  }

  return <JsonEditor payload={payload} onChange={onChange} />;
}

type Line = { sku?: string; description?: string; qty?: number; unitPriceCents?: number; extendedCents?: number };

function LinesEditor({
  payload,
  onChange,
}: {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const lines = payload.lines as Line[];
  const update = (i: number, patch: Partial<Line>) => {
    const next = lines.map((l, idx) => {
      if (idx !== i) return l;
      const merged = { ...l, ...patch };
      merged.extendedCents = (merged.qty ?? 0) * (merged.unitPriceCents ?? 0);
      return merged;
    });
    const subtotal = next.reduce((a, l) => a + (l.extendedCents ?? 0), 0);
    onChange({ ...payload, lines: next, subtotalCents: subtotal, totalCents: subtotal });
  };
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Edit lines — totals recompute</p>
      {lines.map((l, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-bg p-2">
          <span className="w-28 font-mono text-[11px]">{l.sku}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">{l.description}</span>
          <label className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
            qty
            <input
              type="number"
              min={1}
              value={l.qty ?? 0}
              onChange={(e) => update(i, { qty: parseInt(e.target.value || "0", 10) })}
              className="w-16 rounded border border-line bg-surface px-1.5 py-1 text-right font-mono text-[12px] text-ink"
            />
          </label>
          <label className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
            unit $
            <input
              type="number"
              step="0.01"
              min={0}
              value={((l.unitPriceCents ?? 0) / 100).toFixed(2)}
              onChange={(e) => update(i, { unitPriceCents: Math.round(parseFloat(e.target.value || "0") * 100) })}
              className="w-24 rounded border border-line bg-surface px-1.5 py-1 text-right font-mono text-[12px] text-ink"
            />
          </label>
          <span className="w-24 text-right font-mono text-[12px]">{formatCentsExact(l.extendedCents ?? 0)}</span>
        </div>
      ))}
      <p className="text-right font-mono text-[12px]">
        total {formatCentsExact(Number(payload.totalCents ?? 0))}
      </p>
    </div>
  );
}

function DiffsEditor({
  payload,
  onChange,
}: {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const diffs = payload.fieldDiffs as { field: string; old: unknown; new: unknown }[];
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Edit proposed values</p>
      {diffs.map((d, i) =>
        d.field === "__create__" ? null : (
          <label key={i} className="flex items-center gap-2 text-[12px]">
            <span className="w-32 shrink-0 font-mono text-[11px] text-ink-faint">{d.field}</span>
            <span className="w-32 shrink-0 truncate font-mono text-[11px] text-ink-faint line-through">
              {String(d.old ?? "—")}
            </span>
            <input
              value={String(d.new ?? "")}
              onChange={(e) => {
                const next = diffs.map((x, idx) => (idx === i ? { ...x, new: e.target.value } : x));
                onChange({ ...payload, fieldDiffs: next });
              }}
              className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 font-mono text-[12px] text-ink"
            />
          </label>
        ),
      )}
    </div>
  );
}

function SampleItemsEditor({
  payload,
  onChange,
}: {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const items = payload.items as { sku?: string; name?: string; size?: string; qty?: number }[];
  const update = (i: number, patch: Partial<(typeof items)[number]>) =>
    onChange({ ...payload, items: items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border border-line bg-bg p-2 text-[12px]">
          <span className="w-28 font-mono text-[11px]">{item.sku}</span>
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <select
            value={item.size ?? "8x10"}
            onChange={(e) => update(i, { size: e.target.value })}
            className="rounded border border-line bg-surface px-1.5 py-1 font-mono text-[11px]"
          >
            <option value="chip">chip</option>
            <option value="8x10">8x10</option>
            <option value="full_sheet">full sheet</option>
          </select>
          <input
            type="number"
            min={1}
            value={item.qty ?? 1}
            onChange={(e) => update(i, { qty: parseInt(e.target.value || "1", 10) })}
            className="w-14 rounded border border-line bg-surface px-1.5 py-1 text-right font-mono text-[11px]"
          />
        </div>
      ))}
    </div>
  );
}

function JsonEditor({
  payload,
  onChange,
}: {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(JSON.stringify(payload, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Edit payload (JSON)</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setError(null);
          } catch {
            setError("invalid JSON — fix before saving");
          }
        }}
        className="min-h-[260px] w-full rounded-md border border-line bg-bg p-2.5 font-mono text-[11px] leading-relaxed text-ink"
      />
      {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
