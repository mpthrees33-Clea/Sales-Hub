"use client";

/**
 * <ApprovalCard /> — the shared frame around every per-kind approval body
 * (docs/03 §4). Header carries the acting agent's <AgentBadge/>, <RiskTierTag/>,
 * age/expiry, and a run-trace link; footer carries Approve / Edit / Reject
 * (or Save & approve / Cancel in edit mode). Kind-specific bodies render as
 * children. Contract created here in WO-03; WO-06 reuses it.
 */
import Link from "next/link";
import { Check, Clock, Pencil, ScrollText, X } from "lucide-react";
import { AgentBadge, type AgentBadgeTool } from "@/components/agent-badge";
import { RiskTierTag } from "@/components/risk-tier-tag";
import { Button } from "@/components/ui";

export function ApprovalCard({
  agentName,
  agentTools,
  riskTier,
  ageLabel,
  expiryLabel,
  runId,
  editing,
  busy,
  headerRight,
  onApprove,
  onEdit,
  onReject,
  onSave,
  onCancel,
  children,
}: {
  agentName: string | null;
  agentTools: AgentBadgeTool[];
  riskTier: "low" | "standard" | "high";
  ageLabel: string;
  expiryLabel: string;
  runId: string | null;
  editing: boolean;
  busy: boolean;
  headerRight?: React.ReactNode;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <AgentBadge agentName={agentName ?? "agent"} tools={agentTools} />
        <RiskTierTag tier={riskTier} />
        <span className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
          <Clock className="h-3 w-3" /> {ageLabel} · expires {expiryLabel}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {headerRight}
          {runId ? (
            <Link
              href={`/dashboard?run=${runId}`}
              className="flex items-center gap-1 font-mono text-[10px] text-accent hover:underline"
              title="Watch the harness think"
            >
              <ScrollText className="h-3 w-3" /> trace
            </Link>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

      {/* Fixed bottom action bar with ≥44px touch targets on phone (docs/03 §2, task 16). */}
      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        {editing ? (
          <>
            <Button variant="primary" onClick={onSave} disabled={busy} className="min-h-[44px] flex-1 sm:min-h-[36px] sm:flex-none">
              <Check className="h-3.5 w-3.5" /> Save &amp; approve
              <span className="ml-1 font-mono text-[10px] opacity-70">⌘⏎</span>
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={busy} className="min-h-[44px] flex-1 sm:min-h-[36px] sm:flex-none">
              Cancel <span className="ml-1 font-mono text-[10px] opacity-70">esc</span>
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={onApprove} disabled={busy} className="min-h-[44px] flex-1 sm:min-h-[36px] sm:flex-none">
              <Check className="h-3.5 w-3.5" /> Approve <span className="ml-1 font-mono text-[10px] opacity-70">a</span>
            </Button>
            <Button variant="default" onClick={onEdit} disabled={busy} className="min-h-[44px] flex-1 sm:min-h-[36px] sm:flex-none">
              <Pencil className="h-3.5 w-3.5" /> Edit <span className="ml-1 font-mono text-[10px] opacity-70">e</span>
            </Button>
            <Button variant="danger" onClick={onReject} disabled={busy} className="min-h-[44px] flex-1 sm:min-h-[36px] sm:flex-none">
              <X className="h-3.5 w-3.5" /> Reject <span className="ml-1 font-mono text-[10px] opacity-70">r</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
