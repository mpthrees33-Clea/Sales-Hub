"use client";

/**
 * Per-kind approval card bodies (docs/03 §4, WO-03 task 3). Each renders the
 * proposed action natively — an email looks like an email, a sales order like
 * an order form with the seven-layer checklist, an opportunity update as a
 * field-level diff. In edit mode the same body exposes inline editors bound to
 * the working payload. A generic fallback covers scene_send and any future kind.
 */
import { REP } from "@/lib/rep";
import { formatCentsExact } from "@/lib/money";
import { DraftEditor, type DraftValue } from "@/components/draft-editor";
import { LinesTable, Totals, ValidationChecklist, recalcTotals, type Line, type ValidationLayer } from "./parts";

export type CardProps = {
  proposed: Record<string, unknown>;
  editing: boolean;
  patch: (mutator: (draft: Record<string, unknown>) => void) => void;
};

// ── email_draft ──────────────────────────────────────────────────────────────

export function CardEmailDraft({ proposed, editing, patch }: CardProps) {
  const p = proposed as {
    to?: string[]; cc?: string[]; subject?: string; bodyText?: string; attachmentAssetIds?: string[];
  };
  if (editing) {
    const value: DraftValue = {
      to: p.to ?? [], cc: p.cc ?? [], subject: p.subject ?? "", bodyText: p.bodyText ?? "", attachmentAssetIds: p.attachmentAssetIds ?? [],
    };
    return (
      <DraftEditor
        value={value}
        onChange={(next) =>
          patch((d) => {
            d.to = next.to;
            d.cc = next.cc;
            d.subject = next.subject;
            d.bodyText = next.bodyText;
            d.attachmentAssetIds = next.attachmentAssetIds;
          })
        }
      />
    );
  }
  return (
    <div>
      <div className="mb-3 space-y-0.5 border-b border-line pb-2 font-mono text-[11px]">
        <div><span className="mr-2 text-ink-faint">From</span>{REP.email}</div>
        <div><span className="mr-2 text-ink-faint">To</span>{(p.to ?? []).join(", ")}</div>
        {p.cc?.length ? <div><span className="mr-2 text-ink-faint">Cc</span>{p.cc.join(", ")}</div> : null}
        <div className="text-ink"><span className="mr-2 text-ink-faint">Subject</span>{p.subject}</div>
      </div>
      <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">{p.bodyText}</pre>
    </div>
  );
}

// ── quote ────────────────────────────────────────────────────────────────────

export function CardQuote({ proposed, editing, patch }: CardProps) {
  const p = proposed as { quoteNumber?: string; accountName?: string; lines?: Line[]; subtotalCents?: number; totalCents?: number; validUntil?: string; validation?: ValidationLayer[] };
  const onEditLine = (i: number, lp: Partial<Line>) =>
    patch((d) => {
      const lines = d.lines as Line[];
      lines[i] = { ...lines[i], ...lp };
      recalcTotals(d);
    });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[12px]">{p.quoteNumber}</span>
        <span className="text-[12px] text-ink-muted">{p.accountName}</span>
      </div>
      <LinesTable lines={p.lines ?? []} editing={editing} onEditLine={onEditLine} showProvenance />
      <Totals subtotalCents={p.subtotalCents} totalCents={p.totalCents} />
      {p.validUntil ? <p className="mt-1 text-right font-mono text-[10px] text-ink-faint">valid until {p.validUntil}</p> : null}
      {p.validation ? <ValidationChecklist layers={p.validation} /> : null}
    </div>
  );
}

// ── sales_order ──────────────────────────────────────────────────────────────

export function CardSalesOrder({ proposed, editing, patch }: CardProps) {
  const p = proposed as { accountName?: string; customerPoNumber?: string; lines?: Line[]; subtotalCents?: number; totalCents?: number; validation?: ValidationLayer[] };
  const onEditLine = (i: number, lp: Partial<Line>) =>
    patch((d) => {
      const lines = d.lines as Line[];
      lines[i] = { ...lines[i], ...lp };
      recalcTotals(d);
    });
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className="text-ink-muted">{p.accountName}</span>
        <span className="font-mono text-[11px] text-ink-faint">customer PO {p.customerPoNumber}</span>
      </div>
      <LinesTable lines={p.lines ?? []} editing={editing} onEditLine={onEditLine} />
      <Totals subtotalCents={p.subtotalCents} totalCents={p.totalCents} />
      {p.validation ? <ValidationChecklist layers={p.validation} /> : null}
    </div>
  );
}

// ── sample_order ─────────────────────────────────────────────────────────────

export function CardSampleOrder({ proposed, editing, patch }: CardProps) {
  const p = proposed as { contactName?: string; items?: { sku?: string; name?: string; size?: string; qty?: number }[]; shipTo?: { source?: string } };
  const onEditQty = (i: number, qty: number) =>
    patch((d) => {
      const items = d.items as { qty?: number }[];
      items[i] = { ...items[i], qty: Math.max(1, qty) };
    });
  return (
    <div>
      <p className="mb-2 text-[12px] text-ink-muted">
        For {p.contactName} · ship to <span className="font-mono text-[11px]">{p.shipTo?.source ?? "account_on_file"}</span> ·{" "}
        <span className="text-ok">low tier — batch-approvable</span>
      </p>
      <ul className="space-y-2">
        {(p.items ?? []).map((it, i) => (
          <li key={i} className="flex items-center gap-3 rounded-md border border-line p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/blob/swatches/${it.sku}.svg`} alt="" className="h-9 w-9 shrink-0 rounded border border-line object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{it.name}</span>
              <span className="font-mono text-[10px] text-ink-faint">{it.sku} · {it.size}</span>
            </span>
            {editing ? (
              <input
                type="number"
                className="w-14 rounded border border-line bg-surface2 px-1 py-0.5 text-right font-mono text-[12px]"
                value={it.qty ?? 1}
                onChange={(e) => onEditQty(i, parseInt(e.target.value, 10) || 1)}
                aria-label={`qty ${it.sku}`}
              />
            ) : (
              <span className="font-mono text-[12px] tabular-nums">×{it.qty ?? 1}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── opportunity_update ───────────────────────────────────────────────────────

export function CardOpportunityUpdate({ proposed, editing, patch }: CardProps) {
  const p = proposed as {
    accountName?: string;
    newOpportunity?: { name?: string; stage?: string; valueCents?: number };
    fieldDiffs?: { field: string; old: unknown; new: unknown }[];
    rationale?: string;
  };
  const nw = p.newOpportunity;
  return (
    <div className="space-y-3">
      {nw ? (
        <div className="rounded-md border border-accent/30 bg-accent-dim p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] font-medium text-accent-ink">NEW</span>
            <span className="text-[12px] text-ink-muted">{p.accountName}</span>
          </div>
          {editing ? (
            <div className="space-y-1.5">
              <input
                className="w-full rounded border border-line bg-surface2 px-2 py-1 text-[13px]"
                value={nw.name ?? ""}
                onChange={(e) => patch((d) => { (d.newOpportunity as { name?: string }).name = e.target.value; })}
                aria-label="opportunity name"
              />
              <div className="flex gap-2">
                <input
                  className="w-32 rounded border border-line bg-surface2 px-2 py-1 font-mono text-[12px]"
                  value={nw.stage ?? ""}
                  onChange={(e) => patch((d) => { (d.newOpportunity as { stage?: string }).stage = e.target.value; })}
                  aria-label="stage"
                />
                <input
                  type="number"
                  className="w-32 rounded border border-line bg-surface2 px-2 py-1 text-right font-mono text-[12px]"
                  value={((nw.valueCents ?? 0) / 100).toFixed(0)}
                  onChange={(e) => patch((d) => { (d.newOpportunity as { valueCents?: number }).valueCents = Math.round((parseFloat(e.target.value) || 0) * 100); })}
                  aria-label="value dollars"
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-[13px] font-medium">{nw.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-muted">stage {nw.stage} · {formatCentsExact(nw.valueCents ?? 0)}</p>
            </>
          )}
        </div>
      ) : null}
      {(p.fieldDiffs ?? []).filter((d) => d.field !== "__create__").map((d, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-1.5 text-[12px]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{d.field}</span>
          <span className="text-ink-muted line-through decoration-danger/50">{String(d.old ?? "—")}</span>
          <span className="text-ink-faint">→</span>
          <span className="text-ink">{String(d.new ?? "—")}</span>
        </div>
      ))}
      {p.rationale ? <p className="border-t border-line pt-2 text-[11px] italic text-ink-muted">{p.rationale}</p> : null}
    </div>
  );
}

// ── submittal ────────────────────────────────────────────────────────────────

export function CardSubmittal({ proposed, editing, patch }: CardProps) {
  const p = proposed as { projectName?: string; packageTitle?: string; sections?: { sku?: string; productName?: string; docKinds?: string[] }[] };
  return (
    <div>
      <p className="mb-1 text-[12px] text-ink-muted">{p.projectName}</p>
      {editing ? (
        <input
          className="mb-3 w-full rounded border border-line bg-surface2 px-2 py-1 text-[13px]"
          value={p.packageTitle ?? ""}
          onChange={(e) => patch((d) => { d.packageTitle = e.target.value; })}
          aria-label="package title"
        />
      ) : (
        <p className="mb-3 text-[13px] font-medium">{p.packageTitle}</p>
      )}
      <ul className="divide-y divide-line rounded-md border border-line">
        {(p.sections ?? []).map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="min-w-0">
              <span className="text-[13px]">{s.productName}</span>
              <span className="ml-2 font-mono text-[10px] text-ink-faint">{s.sku}</span>
            </span>
            <span className="flex flex-wrap gap-1">
              {(s.docKinds ?? []).map((k) => (
                <span key={k} className="rounded border border-line px-1 py-0.5 font-mono text-[9px] text-ink-muted">{k}</span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── generic fallback (scene_send + any future kind) ──────────────────────────

export function CardGeneric({ proposed, editing, patch }: CardProps) {
  if (editing) {
    return (
      <textarea
        className="min-h-[240px] w-full rounded-md border border-line bg-surface2/40 p-2 font-mono text-[11px] leading-relaxed outline-none"
        defaultValue={JSON.stringify(proposed, null, 2)}
        onChange={(e) => {
          try {
            const next = JSON.parse(e.target.value) as Record<string, unknown>;
            patch((d) => {
              for (const k of Object.keys(d)) delete d[k];
              Object.assign(d, next);
            });
          } catch {
            // keep last valid payload until JSON parses
          }
        }}
        aria-label="raw proposed action"
      />
    );
  }
  const entries = Object.entries(proposed).filter(([, v]) => typeof v !== "object");
  return (
    <div>
      <dl className="mb-3 divide-y divide-line rounded-md border border-line">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-3 py-1.5">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{k}</dt>
            <dd className="text-right text-[12px] text-ink">{String(v)}</dd>
          </div>
        ))}
      </dl>
      <pre className="max-h-64 overflow-auto rounded-md bg-bg p-2 font-mono text-[10px] leading-relaxed text-ink-muted">
        {JSON.stringify(proposed, null, 2)}
      </pre>
    </div>
  );
}
