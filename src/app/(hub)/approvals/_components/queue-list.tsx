"use client";

/**
 * Approval queue list (docs/03 §4, WO-03 task 2). Grouped high → standard → low,
 * then by kind within a tier; each row shows a kind icon, one-line summary,
 * agent name, <RiskTierTag/>, and demo-clock-relative age. Selection is
 * instant (everything is pre-fetched — draft-ahead).
 */
import { FileText, Inbox, Layers, Mail, Package, Receipt, Sparkles, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RiskTierTag } from "@/components/risk-tier-tag";
import { cn } from "@/lib/utils";
import type { LoadedApproval } from "@/lib/queries/approvals";

export const KIND_ICON: Record<string, LucideIcon> = {
  email_draft: Mail,
  quote: Receipt,
  sales_order: FileText,
  sample_order: Package,
  opportunity_update: TrendingUp,
  submittal: Layers,
  scene_send: Sparkles,
};

export function summarize(a: LoadedApproval): string {
  const p = a.proposedAction;
  switch (a.kind) {
    case "email_draft":
      return String(p.subject ?? "Email draft");
    case "quote":
      return `Quote ${p.quoteNumber ?? ""} · ${p.accountName ?? ""}`.trim();
    case "sales_order":
      return `Sales order · PO ${p.customerPoNumber ?? ""} · ${p.accountName ?? ""}`.trim();
    case "sample_order":
      return `Samples · ${p.contactName ?? "contact"}`;
    case "opportunity_update": {
      const nw = p.newOpportunity as { name?: string } | undefined;
      return nw?.name ?? "Opportunity update";
    }
    case "submittal":
      return String(p.packageTitle ?? "Submittal package");
    case "scene_send":
      return String(p.note ?? "Scene send");
    default:
      return a.kind;
  }
}

const TIER_LABEL: Record<string, string> = { high: "High risk", standard: "Standard", low: "Low · batch-approvable" };

function relAge(createdIso: string, demoNowIso: string): string {
  const mins = Math.max(0, Math.round((new Date(demoNowIso).getTime() - new Date(createdIso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function QueueList({
  pending,
  demoNow,
  selectedId,
  onSelect,
}: {
  pending: LoadedApproval[];
  demoNow: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
        <Inbox className="h-5 w-5 text-ink-muted" />
        <p className="text-[13px] font-medium">The queue is clear</p>
        <p className="max-w-xs text-[11px] text-ink-muted">Every agent draft terminates here. Drafts only — humans send.</p>
      </div>
    );
  }

  const tiers: ("high" | "standard" | "low")[] = ["high", "standard", "low"];
  return (
    <div className="divide-y divide-line">
      {tiers.map((tier) => {
        const items = pending.filter((a) => a.riskTier === tier);
        if (items.length === 0) return null;
        return (
          <div key={tier}>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-surface2/80 px-3 py-1.5 backdrop-blur">
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{TIER_LABEL[tier]}</span>
              <span className="font-mono text-[9px] text-ink-faint">{items.length}</span>
            </div>
            {items.map((a) => {
              const Icon = KIND_ICON[a.kind] ?? FileText;
              const active = a.id === selectedId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                    active ? "bg-accent-dim" : "hover:bg-surface2",
                    active ? "border-l-2 border-l-accent" : "border-l-2 border-l-transparent",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-medium">{summarize(a)}</span>
                      {a.blockedReason ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" title="blocked" /> : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-faint">
                      <span className="truncate">{a.agentName ?? "agent"}</span>
                      <span>· {relAge(a.createdDemoAt, demoNow)}</span>
                    </span>
                  </span>
                  <RiskTierTag tier={a.riskTier} />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
