/**
 * Approval-row creation — the contract between agents and humans
 * (docs/02-SECURITY-FRAMEWORK.md §3). Used by the harness (external-tool
 * interception, escalations) and by workflows (PO intake finalize). Creating
 * approvals is agent-reachable; RESOLVING them never is — resolution lives
 * solely in WO-03's server action.
 */
import { db } from "@/db/client";
import { approvals, type Evidence } from "@/db/schema";
import { audit } from "@/lib/audit";
import { assignRiskTier, POLICY_CONFIG, type RiskTier } from "./policy-gate";
import type { ApprovalKind } from "./tool";

export async function createApprovalRow(opts: {
  runId: string | null;
  agentName: string;
  kind: ApprovalKind;
  proposedAction: Record<string, unknown>;
  evidence: Evidence[];
  demoNow: Date;
  /** Override the deterministic tier (rare; e.g. escalations forced standard). */
  riskTier?: RiskTier;
}): Promise<{ approvalId: string; riskTier: RiskTier }> {
  const riskTier = opts.riskTier ?? assignRiskTier(opts.kind, opts.proposedAction);
  const expires = new Date(opts.demoNow.getTime() + POLICY_CONFIG.approvalExpiryHours * 3600_000);
  const [row] = await db
    .insert(approvals)
    .values({
      runId: opts.runId,
      kind: opts.kind,
      riskTier,
      proposedAction: opts.proposedAction,
      evidence: opts.evidence,
      status: "pending",
      createdDemoAt: opts.demoNow,
      expiresDemoAt: expires,
    })
    .returning({ id: approvals.id });
  await audit({
    actor: `agent:${opts.agentName}`,
    action: "approval.created",
    objectType: "approval",
    objectId: row!.id,
    detail: { kind: opts.kind, riskTier, runId: opts.runId },
  });
  return { approvalId: row!.id, riskTier };
}
