"use client";

/**
 * Per-kind approval card bodies (WO-03 task 3): each proposed action renders
 * natively — an email draft looks like an email, a sales order looks like an
 * order form with the seven-layer checklist, an opportunity update shows
 * field-level diffs. Generic fallback for scene_send and future kinds.
 */
import { ArrowRight, CheckCircle2, Clock, Paperclip, XCircle } from "lucide-react";
import { Mono, StatusPill } from "@/components/ui";
import { formatCentsExact } from "@/lib/money";
import { formatDurationMs } from "@/lib/dates";
import type { QueueApproval } from "@/lib/queries/approvals";

export function CardBody({ approval, assetTitles }: { approval: QueueApproval; assetTitles: Map<string, string> }) {
  switch (approval.kind) {
    case "email_draft":
      return <EmailDraftCard approval={approval} assetTitles={assetTitles} />;
    case "quote":
      return <QuoteCard approval={approval} />;
    case "sales_order":
      return <SalesOrderCard approval={approval} />;
    case "sample_order":
      return <SampleOrderCard approval={approval} />;
    case "opportunity_update":
      return <OpportunityUpdateCard approval={approval} />;
    case "submittal":
      return <SubmittalCard approval={approval} />;
    default:
      return <GenericCard approval={approval} />;
  }
}

function escalationBanner(approval: QueueApproval) {
  const esc = approval.proposedAction.escalation as { reason?: string; detail?: Record<string, unknown> } | undefined;
  if (!esc) return null;
  return (
    <div className="mb-3 rounded-md border border-warn/40 bg-warn-dim p-3">
      <p className="text-xs font-medium text-warn">Grounded or it escalates — human input needed</p>
      <p className="mt-1 font-mono text-[11px] text-ink-muted">{esc.reason}</p>
      {esc.detail ? (
        <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-ink-muted">
          {JSON.stringify(esc.detail, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function EmailDraftCard({ approval, assetTitles }: { approval: QueueApproval; assetTitles: Map<string, string> }) {
  const p = approval.proposedAction as {
    to?: string[];
    cc?: string[];
    subject?: string;
    bodyText?: string;
    body_markdown?: string;
    attachmentAssetIds?: string[];
    attachment_pds_ids?: string[];
    latencyMs?: number;
  };
  const attachments = [...(p.attachmentAssetIds ?? []), ...(p.attachment_pds_ids ?? [])];
  return (
    <div>
      {escalationBanner(approval)}
      <div className="rounded-md border border-line bg-bg">
        <div className="space-y-1 border-b border-line px-3.5 py-2.5 text-[12px]">
          <Row label="From">Cole Mercer &lt;cole.mercer@meridian-surfaces.example.com&gt;</Row>
          <Row label="To">{(p.to ?? []).join(", ")}</Row>
          {p.cc?.length ? <Row label="Cc">{p.cc.join(", ")}</Row> : null}
          <Row label="Subject">
            <span className="font-medium text-ink">{p.subject}</span>
          </Row>
        </div>
        <div className="whitespace-pre-wrap px-3.5 py-3 font-mono text-[12px] leading-relaxed text-ink">
          {p.bodyText ?? p.body_markdown ?? ""}
        </div>
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t border-line px-3.5 py-2">
            {attachments.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-ink-muted"
              >
                <Paperclip className="h-3 w-3" />
                {assetTitles.get(id) ?? id.slice(0, 8)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {typeof p.latencyMs === "number" ? (
        <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-accent">
          <Clock className="h-3 w-3" /> drafted {formatDurationMs(p.latencyMs)} after receipt
        </p>
      ) : null}
    </div>
  );
}

type Lineish = {
  sku?: string;
  description?: string;
  qty?: number;
  uom?: string;
  unitPriceCents?: number;
  extendedCents?: number;
  splitProposed?: boolean;
};

function LinesTable({ lines, subtotalCents, totalCents }: { lines: Lineish[]; subtotalCents?: number; totalCents?: number }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line bg-surface2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="px-2.5 py-1.5">SKU</th>
            <th className="px-2.5 py-1.5">Description</th>
            <th className="px-2.5 py-1.5 text-right">Qty</th>
            <th className="px-2.5 py-1.5">UOM</th>
            <th className="px-2.5 py-1.5 text-right">Unit</th>
            <th className="px-2.5 py-1.5 text-right">Extended</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              <td className="px-2.5 py-1.5 font-mono text-[11px]">{l.sku}</td>
              <td className="px-2.5 py-1.5">
                {l.description}
                {l.splitProposed ? <StatusPill tone="warn" className="ml-1.5">SPLIT</StatusPill> : null}
              </td>
              <td className="px-2.5 py-1.5 text-right font-mono">{l.qty}</td>
              <td className="px-2.5 py-1.5">{l.uom}</td>
              <td className="px-2.5 py-1.5 text-right font-mono">{formatCentsExact(l.unitPriceCents ?? 0)}</td>
              <td className="px-2.5 py-1.5 text-right font-mono">
                {formatCentsExact(l.extendedCents ?? (l.qty ?? 0) * (l.unitPriceCents ?? 0))}
              </td>
            </tr>
          ))}
        </tbody>
        {subtotalCents !== undefined || totalCents !== undefined ? (
          <tfoot>
            <tr className="border-t border-line bg-surface2 font-mono text-[11px]">
              <td colSpan={5} className="px-2.5 py-1.5 text-right text-ink-muted">
                Total
              </td>
              <td className="px-2.5 py-1.5 text-right font-medium">
                {formatCentsExact(totalCents ?? subtotalCents ?? 0)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export function ValidationChecklist({
  validation,
  animate,
}: {
  validation: { layer: number; name: string; pass: boolean; detail?: Record<string, unknown> }[];
  animate?: boolean;
}) {
  return (
    <ol className="space-y-1">
      {validation.map((v, i) => (
        <li
          key={v.layer}
          className="rounded-md border border-transparent"
          style={animate ? { animation: `fadeIn 240ms ease ${i * 90}ms both` } : undefined}
        >
          <details>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-0.5">
              {v.pass ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
              )}
              <span className="font-mono text-[11px] text-ink-muted">L{v.layer}</span>
              <span className={`font-mono text-[11px] ${v.pass ? "text-ink" : "text-danger"}`}>{v.name}</span>
            </summary>
            {v.detail && Object.keys(v.detail).length > 0 ? (
              <pre className="ml-7 mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-bg p-1.5 font-mono text-[10px] text-ink-muted">
                {JSON.stringify(v.detail, null, 2)}
              </pre>
            ) : null}
          </details>
        </li>
      ))}
    </ol>
  );
}

function SalesOrderCard({ approval }: { approval: QueueApproval }) {
  const p = approval.proposedAction as {
    customerPoNumber?: string;
    accountName?: string;
    lines?: Lineish[];
    subtotalCents?: number;
    totalCents?: number;
    validation?: { layer: number; name: string; pass: boolean; detail?: Record<string, unknown> }[];
    blocking_layers?: { layer: number; name: string; detail?: Record<string, unknown> }[];
    poId?: string;
  };
  return (
    <div className="space-y-3">
      {escalationBanner(approval)}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium">{p.accountName ?? "Draft sales order"}</p>
          {p.customerPoNumber ? (
            <p className="font-mono text-[11px] text-ink-muted">
              customer PO <Mono>{p.customerPoNumber}</Mono>
            </p>
          ) : null}
        </div>
      </div>
      {p.lines?.length ? <LinesTable lines={p.lines} subtotalCents={p.subtotalCents} totalCents={p.totalCents} /> : null}
      {p.validation?.length ? (
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Seven-layer validation
          </p>
          <ValidationChecklist validation={p.validation} />
        </div>
      ) : null}
      {p.blocking_layers?.length ? (
        <div className="rounded-md border border-warn/40 bg-warn-dim p-3">
          <p className="text-xs font-medium text-warn">Escalated — grounded or it escalates</p>
          {p.blocking_layers.map((b) => (
            <p key={b.layer} className="mt-1 font-mono text-[11px] text-ink-muted">
              L{b.layer} {b.name}: {JSON.stringify(b.detail)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuoteCard({ approval }: { approval: QueueApproval }) {
  const p = approval.proposedAction as {
    quoteNumber?: string;
    accountName?: string;
    lines?: Lineish[];
    subtotalCents?: number;
    totalCents?: number;
    validUntil?: string;
    latencyMs?: number;
    splitProposed?: boolean;
  };
  return (
    <div className="space-y-3">
      {escalationBanner(approval)}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium">
            Quote <Mono>{p.quoteNumber}</Mono> — {p.accountName}
          </p>
          {p.validUntil ? <p className="font-mono text-[11px] text-ink-muted">valid until {p.validUntil}</p> : null}
        </div>
        {typeof p.latencyMs === "number" ? (
          <span className="flex items-center gap-1 font-mono text-[10px] text-accent">
            <Clock className="h-3 w-3" /> drafted {formatDurationMs(p.latencyMs)} after receipt
          </span>
        ) : null}
      </div>
      {p.lines?.length ? <LinesTable lines={p.lines} subtotalCents={p.subtotalCents} totalCents={p.totalCents} /> : null}
      {p.splitProposed ? (
        <p className="text-[11px] text-warn">Split shipment proposed — ship available stock now, backorder the rest.</p>
      ) : null}
    </div>
  );
}

function SampleOrderCard({ approval }: { approval: QueueApproval }) {
  const p = approval.proposedAction as {
    contactName?: string;
    accountName?: string;
    items?: { sku?: string; name?: string; size?: string; qty?: number }[];
    shipTo?: { line1?: string; city?: string; state?: string; zip?: string; source?: string };
  };
  return (
    <div className="space-y-3">
      {escalationBanner(approval)}
      <p className="text-[13px]">
        Sample order for <span className="font-medium">{p.contactName ?? p.accountName ?? "contact"}</span>
      </p>
      <ul className="space-y-1.5">
        {(p.items ?? []).map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-[12px]">
            <span className="h-4 w-4 rounded-sm border border-line bg-surface2" aria-hidden />
            <Mono className="text-ink-muted">{item.sku}</Mono>
            <span>{item.name}</span>
            <span className="text-ink-faint">
              · {item.size ?? "8x10"} × {item.qty ?? 1}
            </span>
          </li>
        ))}
      </ul>
      {p.shipTo ? (
        <p className="font-mono text-[11px] text-ink-muted">
          ship to: {[p.shipTo.line1, p.shipTo.city, p.shipTo.state, p.shipTo.zip].filter(Boolean).join(", ")}
          {p.shipTo.source === "account_on_file" ? " (account address on file)" : ""}
        </p>
      ) : null}
      <p className="text-[10px] text-ink-faint">Low tier — batch-approvable with shift+A.</p>
    </div>
  );
}

function OpportunityUpdateCard({ approval }: { approval: QueueApproval }) {
  const p = approval.proposedAction as {
    accountName?: string;
    opportunityName?: string;
    newOpportunity?: { name: string; stage?: string; valueCents?: number; projectHint?: string };
    fieldDiffs?: { field: string; old: unknown; new: unknown }[];
    rationale?: string;
  };
  return (
    <div className="space-y-3">
      {escalationBanner(approval)}
      <p className="text-[13px] font-medium">{p.accountName}</p>
      {p.newOpportunity ? (
        <div className="rounded-md border border-ok/40 bg-ok-dim p-3">
          <div className="flex items-center gap-2">
            <StatusPill tone="ok">NEW</StatusPill>
            <span className="text-[13px] font-medium">{p.newOpportunity.name}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-ink-muted">
            stage {p.newOpportunity.stage ?? "lead"} · est.{" "}
            {formatCentsExact(p.newOpportunity.valueCents ?? 0)}
            {p.newOpportunity.projectHint ? ` · ${p.newOpportunity.projectHint}` : ""}
          </p>
        </div>
      ) : null}
      {(p.fieldDiffs ?? [])
        .filter((d) => d.field !== "__create__")
        .map((d, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
            <span className="text-ink-faint">{d.field}:</span>
            <span className="text-ink-faint line-through">{String(d.old ?? "—")}</span>
            <ArrowRight className="h-3 w-3 text-ink-faint" />
            <span className="text-ink">{String(d.new ?? "—")}</span>
          </div>
        ))}
      {p.rationale ? <p className="text-[11px] leading-relaxed text-ink-muted">{p.rationale}</p> : null}
    </div>
  );
}

function SubmittalCard({ approval }: { approval: QueueApproval }) {
  const p = approval.proposedAction as {
    projectName?: string;
    packageTitle?: string;
    sections?: { sku?: string; productName?: string; docKinds?: string[] }[];
  };
  return (
    <div className="space-y-3">
      {escalationBanner(approval)}
      <div>
        <p className="text-[13px] font-medium">{p.packageTitle ?? "Submittal package"}</p>
        <p className="font-mono text-[11px] text-ink-muted">{p.projectName}</p>
      </div>
      <ol className="space-y-1.5">
        {(p.sections ?? []).map((s, i) => (
          <li key={i} className="text-[12px]">
            <span className="font-mono text-[10px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>{" "}
            <span className="font-medium">{s.productName}</span> <Mono className="text-ink-muted">{s.sku}</Mono>
            <span className="ml-1 text-[10px] text-ink-faint">{(s.docKinds ?? []).join(" · ")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GenericCard({ approval }: { approval: QueueApproval }) {
  return (
    <div className="space-y-2">
      {escalationBanner(approval)}
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {approval.kind} · generic renderer
      </p>
      <div className="space-y-1">
        {Object.entries(approval.proposedAction)
          .filter(([k]) => k !== "escalation")
          .map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[12px]">
              <span className="w-32 shrink-0 font-mono text-[11px] text-ink-faint">{k}</span>
              <span className="min-w-0 break-all font-mono text-[11px] text-ink">
                {typeof v === "string" ? v : JSON.stringify(v)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink-muted">{children}</span>
    </div>
  );
}
