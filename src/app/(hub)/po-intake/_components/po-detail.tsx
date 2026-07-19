"use client";

/**
 * PO detail split-view (WO-06 task 16). Left: <PdfViewer/> page image with an
 * anchor highlight. Right: extracted fields (hover/focus → the viewer highlights
 * the source region) + the seven-layer checklist. Escalated POs show the amber
 * "Grounded or it escalates" banner with the failing layer and resolution actions.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer";
import { Button, StatusPill } from "@/components/ui";
import { formatCentsExact } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PoDetail } from "@/lib/queries/po-intake";
import { Checklist } from "./checklist";
import { fixPricesAndRevalidate, rejectPo } from "../[id]/actions";

type Bbox = [number, number, number, number];
type Anchor = { page: number; bbox?: Bbox };

function Field({ label, value, anchor, onHover, active }: { label: string; value: string; anchor?: Anchor; onHover: (a: Anchor | null) => void; active: boolean }) {
  return (
    <div
      tabIndex={0}
      onMouseEnter={() => anchor && onHover(anchor)}
      onFocus={() => anchor && onHover(anchor)}
      className={cn("flex justify-between gap-3 rounded px-2 py-1 outline-none transition-colors", active ? "bg-accent-dim" : "hover:bg-surface2")}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="text-right text-[12px] text-ink">{value}</span>
    </div>
  );
}

export function PoDetailView({ detail }: { detail: PoDetail }) {
  const ex = detail.extraction;
  const [active, setActive] = useState<Anchor | null>(ex ? { page: ex.customer_po_number.anchor.page, bbox: ex.customer_po_number.anchor.bbox } : null);
  const [pending, startTransition] = useTransition();
  const escalated = detail.status === "escalated";
  const firstFail = detail.validation.find((v) => !v.pass);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/po-intake" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> POs
          </Link>
          <h1 className="font-mono text-lg font-semibold">{ex?.customer_po_number.value ?? detail.id.slice(0, 8)}</h1>
          <StatusPill tone={escalated ? "warn" : detail.status === "converted" ? "ok" : "muted"}>{detail.status}</StatusPill>
        </div>
        <span className="font-mono text-[11px] text-ink-faint">
          {detail.validation.filter((v) => v.pass).length === 7 ? "Validated 7/7" : "—"}
          {detail.elapsedMs != null ? ` · ${(detail.elapsedMs / 1000).toFixed(1)}s` : ""}
        </span>
      </div>

      {escalated ? (
        <div className="rounded-md border border-warn/40 bg-warn-dim px-3 py-2.5">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-warn">Grounded or it escalates</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                Stopped at <span className="font-mono">L{firstFail?.layer} {firstFail?.name.replace(/_/g, " ")}</span>. Correct the source value and re-validate, or reject.
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="primary" disabled={pending} onClick={() => startTransition(async () => { await fixPricesAndRevalidate(detail.id); })}>
                  Fix prices to list &amp; re-validate
                </Button>
                <Button variant="danger" disabled={pending} onClick={() => startTransition(async () => { await rejectPo(detail.id); })}>
                  Reject
                </Button>
                {detail.approvalId ? (
                  <Link href={`/approvals?id=${detail.approvalId}`} className="flex items-center font-mono text-[11px] text-accent hover:underline">
                    view approval →
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : detail.approvalId ? (
        <Link href={`/approvals?id=${detail.approvalId}`} className="inline-block font-mono text-[11px] text-accent hover:underline">
          Draft sales order ready — review approval →
        </Link>
      ) : null}

      {ex ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* PDF pane */}
          <div className="rounded-lg border border-line bg-surface p-3">
            <PdfViewer blobUrl={detail.blobUrl} page={active?.page ?? 1} bbox={active?.bbox} />
          </div>

          {/* Extracted fields */}
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-surface p-3">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Extracted fields</p>
              <Field label="PO #" value={ex.customer_po_number.value} anchor={ex.customer_po_number.anchor} onHover={setActive} active={active?.bbox === ex.customer_po_number.anchor.bbox} />
              <Field label="Date" value={ex.po_date.value} anchor={ex.po_date.anchor} onHover={setActive} active={active?.bbox === ex.po_date.anchor.bbox} />
              <Field label="Bill to" value={ex.bill_to.value.company} anchor={ex.bill_to.anchor} onHover={setActive} active={active?.bbox === ex.bill_to.anchor.bbox} />
              <Field label="Ship to" value={`${ex.ship_to.value.city}, ${ex.ship_to.value.state}`} anchor={ex.ship_to.anchor} onHover={setActive} active={active?.bbox === ex.ship_to.anchor.bbox} />
              <Field label="Buyer" value={ex.buyer_contact.value.name} anchor={ex.buyer_contact.anchor} onHover={setActive} active={active?.bbox === ex.buyer_contact.anchor.bbox} />
              {ex.terms ? <Field label="Terms" value={ex.terms.value} anchor={ex.terms.anchor} onHover={setActive} active={active?.bbox === ex.terms.anchor.bbox} /> : null}
            </div>

            <div className="overflow-x-auto rounded-lg border border-line bg-surface p-3">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Lines</p>
              <table className="w-full text-[12px]">
                <tbody className="divide-y divide-line">
                  {ex.lines.map((l, i) => (
                    <tr
                      key={i}
                      tabIndex={0}
                      onMouseEnter={() => setActive({ page: l.page, bbox: l.bbox })}
                      onFocus={() => setActive({ page: l.page, bbox: l.bbox })}
                      className={cn("cursor-default outline-none transition-colors", active?.bbox === l.bbox ? "bg-accent-dim" : "hover:bg-surface2")}
                    >
                      <td className="py-1 font-mono text-[11px]">{l.raw_sku_text}</td>
                      <td className="py-1 text-ink-muted">{l.description}</td>
                      <td className="py-1 text-right font-mono tabular-nums">{l.qty}</td>
                      <td className="py-1 text-right font-mono tabular-nums">{formatCentsExact(l.unit_price_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-1.5 flex justify-end font-mono text-[12px] font-medium">Total {formatCentsExact(ex.totals.total_cents)}</div>
            </div>

            <div className="rounded-lg border border-line bg-surface p-3">
              <Checklist validation={detail.validation} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-surface p-6 text-center text-[12px] text-ink-muted">
          Extraction unavailable — the PDF could not be read. This PO escalated at extraction.
        </div>
      )}
    </div>
  );
}
