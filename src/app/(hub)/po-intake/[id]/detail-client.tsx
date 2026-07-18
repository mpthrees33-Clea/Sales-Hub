"use client";

/**
 * PO split view (WO-06 tasks 16–17, docs/03 §5): left = PDF page images with
 * highlight overlay; right = extracted fields grouped. Hover/focus a field →
 * the viewer highlights its page/bbox. Below: the seven-layer checklist,
 * animating sequentially (reduced-motion aware); escalated state pins the
 * failing layer open with expected-vs-found and the resolution actions.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { PdfViewer, type PdfHighlight } from "@/components/pdf-viewer";
import { Button, Card, CardHeader, Mono, StatusPill } from "@/components/ui";
import { formatCentsExact } from "@/lib/money";
import { formatDurationMs } from "@/lib/dates";
import type { ValidationLayerResult } from "@/db/schema";
import { cn } from "@/lib/utils";
import { rejectEscalatedPo, resolveEscalatedPo } from "../actions";

type Anchored<T> = { value: T; anchor: { page: number; bbox?: [number, number, number, number] } };
type ExtractionShape = {
  customer_po_number: Anchored<string>;
  po_date: Anchored<string>;
  bill_to: Anchored<{ company: string; line1: string; city: string; state: string; zip: string }>;
  ship_to: Anchored<{ company: string; line1: string; city: string; state: string; zip: string }>;
  buyer_contact: Anchored<{ name: string; email?: string; phone?: string }>;
  referenced_quote_number?: Anchored<string>;
  terms?: Anchored<string>;
  lines: {
    raw_sku_text: string;
    resolved?: { sku: string; method: string };
    description: string;
    qty: number;
    uom: string;
    unit_price_cents: number;
    page: number;
    bbox?: [number, number, number, number];
  }[];
  totals: { subtotal_cents: number; total_cents: number; page: number };
};

export function PoDetailClient({
  po,
  initialField,
}: {
  po: {
    id: string;
    blobUrl: string;
    status: string;
    customerPoNumber: string | null;
    accountName: string | null;
    extracted: Record<string, unknown> | null;
    validation: ValidationLayerResult[] | null;
    elapsedMs: number | null;
    salesOrderNumber: string | null;
  };
  initialField?: string;
}) {
  const router = useRouter();
  const ex = po.extracted as ExtractionShape | null;
  const [highlight, setHighlight] = useState<PdfHighlight | undefined>(() => {
    if (!initialField || !ex) return undefined;
    return anchorForField(ex, initialField);
  });
  const [edited, setEdited] = useState<Record<number, { unit_price_cents?: number; raw_sku_text?: string }>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const failing = useMemo(() => (po.validation ?? []).filter((v) => !v.pass), [po.validation]);
  const escalated = po.status === "escalated";

  const hover = (h?: PdfHighlight) => setHighlight(h);

  const submitEdits = async () => {
    if (!ex) return;
    setBusy(true);
    setMessage(null);
    try {
      const editedExtraction = JSON.parse(JSON.stringify(ex)) as ExtractionShape;
      editedExtraction.lines = editedExtraction.lines.map((l, i) => ({
        ...l,
        raw_sku_text: edited[i]?.raw_sku_text ?? l.raw_sku_text,
        unit_price_cents: edited[i]?.unit_price_cents ?? l.unit_price_cents,
      }));
      // Keep arithmetic consistent with the corrected values (layer 1).
      const subtotal = editedExtraction.lines.reduce((a, l) => a + l.qty * l.unit_price_cents, 0);
      editedExtraction.totals = { ...editedExtraction.totals, subtotal_cents: subtotal, total_cents: subtotal };
      for (const l of editedExtraction.lines as unknown as Record<string, unknown>[]) {
        if ("line_total_cents" in l) {
          l.line_total_cents = (l.qty as number) * (l.unit_price_cents as number);
        }
      }
      const res = await resolveEscalatedPo({
        poId: po.id,
        editedExtraction: editedExtraction as unknown as Record<string, unknown>,
      });
      if (!res.ok) setMessage(res.error ?? "failed");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/po-intake" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
            <ArrowLeft className="h-4 w-4 text-ink-muted" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              <Mono>{po.customerPoNumber ?? po.id.slice(0, 8)}</Mono>
            </h1>
            <p className="font-mono text-[10px] text-ink-faint">{po.accountName ?? "account unresolved"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={escalated ? "warn" : po.status === "converted" ? "ok" : "accent"}>{po.status}</StatusPill>
          {po.elapsedMs ? (
            <span className="font-mono text-[11px] text-ink-muted">
              {failing.length === 0 && po.validation ? "validated 7/7" : ""} · {formatDurationMs(po.elapsedMs)}
            </span>
          ) : null}
          {po.salesOrderNumber ? (
            <StatusPill tone="ok">
              SO <Mono>{po.salesOrderNumber}</Mono>
            </StatusPill>
          ) : null}
        </div>
      </div>

      {escalated ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn-dim p-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <div>
            <p className="text-[13px] font-medium text-warn">Grounded or it escalates</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {failing.map((f) => `L${f.layer} ${f.name}`).join(" · ") || "Extraction failed"} — fix the values on the
              right and re-run all seven layers, or reject.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: source PDF with highlight */}
        <Card className="p-3">
          <PdfViewer url={po.blobUrl} highlight={highlight} />
        </Card>

        {/* Right: extracted fields + checklist */}
        <div className="space-y-4">
          {ex ? (
            <Card>
              <CardHeader n="01" title="Extracted fields — hover to locate on the page" />
              <div className="space-y-1 p-3">
                <Field label="PO number" value={ex.customer_po_number.value} onHover={() => hover(ex.customer_po_number.anchor)} />
                <Field label="PO date" value={ex.po_date.value} onHover={() => hover(ex.po_date.anchor)} />
                <Field label="Bill to" value={`${ex.bill_to.value.company} · ${ex.bill_to.value.city}`} onHover={() => hover(ex.bill_to.anchor)} />
                <Field label="Ship to" value={`${ex.ship_to.value.company} · ${ex.ship_to.value.city}`} onHover={() => hover(ex.ship_to.anchor)} />
                <Field label="Buyer" value={ex.buyer_contact.value.name} onHover={() => hover(ex.buyer_contact.anchor)} />
                {ex.referenced_quote_number ? (
                  <Field label="Ref quote" value={ex.referenced_quote_number.value} onHover={() => hover(ex.referenced_quote_number!.anchor)} />
                ) : null}
                {ex.terms ? <Field label="Terms" value={ex.terms.value} onHover={() => hover(ex.terms!.anchor)} /> : null}

                <div className="pt-2">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Lines</p>
                  {ex.lines.map((l, i) => {
                    const priceFail = failing.some(
                      (f) =>
                        f.name === "price_match" &&
                        Array.isArray((f.detail as { mismatches?: { sku: string }[] }).mismatches) &&
                        (f.detail as { mismatches: { sku: string }[] }).mismatches.some(
                          (m) => m.sku === (l.resolved?.sku ?? l.raw_sku_text),
                        ),
                    );
                    return (
                      <div
                        key={i}
                        tabIndex={0}
                        onMouseEnter={() => hover({ page: l.page, bbox: l.bbox })}
                        onFocus={() => hover({ page: l.page, bbox: l.bbox })}
                        className={cn(
                          "flex flex-wrap items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-[12px] hover:border-line hover:bg-surface2/60",
                          priceFail && "border-danger/40 bg-danger-dim",
                        )}
                      >
                        {escalated && priceFail ? (
                          <>
                            <input
                              value={edited[i]?.raw_sku_text ?? l.raw_sku_text}
                              onChange={(e) => setEdited((s) => ({ ...s, [i]: { ...s[i], raw_sku_text: e.target.value } }))}
                              className="w-28 rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[11px]"
                            />
                            <span className="min-w-0 flex-1 truncate">{l.description}</span>
                            <span className="font-mono">×{l.qty}</span>
                            <label className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
                              $
                              <input
                                type="number"
                                step="0.01"
                                value={((edited[i]?.unit_price_cents ?? l.unit_price_cents) / 100).toFixed(2)}
                                onChange={(e) =>
                                  setEdited((s) => ({
                                    ...s,
                                    [i]: { ...s[i], unit_price_cents: Math.round(parseFloat(e.target.value || "0") * 100) },
                                  }))
                                }
                                className="w-24 rounded border border-danger/40 bg-bg px-1.5 py-0.5 text-right font-mono text-[11px] text-danger"
                              />
                            </label>
                          </>
                        ) : (
                          <>
                            <Mono className="w-28 text-ink-muted">{l.resolved?.sku ?? l.raw_sku_text}</Mono>
                            <span className="min-w-0 flex-1 truncate">{l.description}</span>
                            <span className="font-mono">×{l.qty}</span>
                            <span className="font-mono">{formatCentsExact(l.unit_price_cents)}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Field
                  label="Totals"
                  value={`subtotal ${formatCentsExact(ex.totals.subtotal_cents)} · total ${formatCentsExact(ex.totals.total_cents)}`}
                  onHover={() => hover({ page: ex.totals.page })}
                />
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <p className="text-xs text-ink-muted">No extraction yet — the pipeline is running or failed at extraction.</p>
            </Card>
          )}

          <Card>
            <CardHeader n="02" title="Seven-layer validation" />
            <div className="p-3">
              {po.validation ? (
                <ol className="space-y-1">
                  {po.validation.map((v, i) => (
                    <li key={v.layer} style={{ animation: `fadeIn 200ms ease ${i * 80}ms both` }}>
                      <details open={!v.pass}>
                        <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-1 hover:bg-surface2/60">
                          {v.pass ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0 text-danger" />
                          )}
                          <span className="font-mono text-[11px] text-ink-faint">L{v.layer}</span>
                          <span className={cn("font-mono text-[12px]", v.pass ? "text-ink" : "text-danger")}>{v.name}</span>
                        </summary>
                        {Object.keys(v.detail).length > 0 ? (
                          <pre className="ml-7 mt-1 max-h-44 overflow-auto whitespace-pre-wrap rounded bg-bg p-2 font-mono text-[10px] leading-relaxed text-ink-muted">
                            {JSON.stringify(v.detail, null, 2)}
                          </pre>
                        ) : null}
                      </details>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="font-mono text-[11px] text-ink-muted status-running">layers pending…</p>
              )}
            </div>
          </Card>

          {escalated ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => void submitEdits()} disabled={busy}>
                {busy ? "Re-running layers…" : "Apply fixes & re-run 7 layers"}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setBusy(true);
                  await rejectEscalatedPo(po.id);
                  setBusy(false);
                  router.refresh();
                }}
                disabled={busy}
              >
                Reject PO
              </Button>
              {message ? <span className="text-[11px] text-danger">{message}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(2px);} to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

function Field({ label, value, onHover }: { label: string; value: string; onHover: () => void }) {
  return (
    <div
      tabIndex={0}
      onMouseEnter={onHover}
      onFocus={onHover}
      className="flex items-baseline gap-2 rounded-md border border-transparent px-1.5 py-1 text-[12px] hover:border-line hover:bg-surface2/60"
    >
      <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
    </div>
  );
}

function anchorForField(ex: ExtractionShape, field: string): PdfHighlight | undefined {
  if (field.startsWith("lines[")) {
    const idx = parseInt(field.slice(6), 10);
    const line = ex.lines[idx];
    return line ? { page: line.page, bbox: line.bbox } : undefined;
  }
  const anchored = (ex as unknown as Record<string, Anchored<unknown> | undefined>)[field];
  if (anchored?.anchor) return anchored.anchor;
  if (field === "totals") return { page: ex.totals.page };
  return undefined;
}
