/**
 * Approval resolution core (WO-03 task 9) — the executor logic, independent of
 * the request context so it is directly testable. The server action in
 * app/(hub)/approvals/actions.ts wraps this with requireSession() and
 * revalidatePath(). This is the ONLY place external effects execute, and it is
 * unreachable by any agent tool. The deterministic policy gate re-runs here at
 * execution time against the resolved (possibly edited) payload.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentRuns, approvals } from "@/db/schema";
import { audit } from "@/lib/audit";
import { getDemoNow } from "@/lib/demo-clock";
import { runPolicyGate } from "@/harness/policy-gate";
import { computeDiff } from "./diff";
import { executeApproval } from "./execute";
import { isExpired } from "./expiry";

export type Resolution = "approve" | "edit_approve" | "reject";

export type ResolveResult =
  | { outcome: "approved"; status: "approved" | "edited_approved"; auditId: string; ref: string }
  | { outcome: "rejected" }
  | { outcome: "expired" }
  | { outcome: "blocked"; rule: string; reason: string }
  | { outcome: "not_pending" }
  | { outcome: "not_found" }
  | { outcome: "error"; message: string };

export type ResolveInput = {
  id: string;
  resolution: Resolution;
  edited?: Record<string, unknown>;
  batch?: boolean;
};

async function agentNameForRun(runId: string | null): Promise<string | null> {
  if (!runId) return null;
  const row = await db.query.agentRuns.findFirst({ columns: { agentName: true }, where: eq(agentRuns.id, runId) });
  return row?.agentName ?? null;
}

export async function resolveApprovalCore(input: ResolveInput, userId: string): Promise<ResolveResult> {
  const demoNow = await getDemoNow();

  const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, input.id) });
  if (!approval) return { outcome: "not_found" };
  if (approval.status !== "pending") return { outcome: "not_pending" };

  // Expiry — never execute a stale approval.
  if (isExpired(approval, demoNow)) {
    await db
      .update(approvals)
      .set({ status: "expired", resolvedAt: demoNow })
      .where(and(eq(approvals.id, approval.id), eq(approvals.status, "pending")));
    await audit({ actor: "system", action: "approval.expired", objectType: "approval", objectId: approval.id });
    return { outcome: "expired" };
  }

  // Reject — no gate call, no provider call, no side effects.
  if (input.resolution === "reject") {
    const claimed = await db
      .update(approvals)
      .set({ status: "rejected", resolvedAt: demoNow, approverUserId: userId })
      .where(and(eq(approvals.id, approval.id), eq(approvals.status, "pending")))
      .returning({ id: approvals.id });
    if (claimed.length === 0) return { outcome: "not_pending" };
    await audit({ actor: `user:${userId}`, action: "approval.rejected", objectType: "approval", objectId: approval.id });
    return { outcome: "rejected" };
  }

  // Approve paths — resolve the (possibly edited) payload and re-run the gate.
  const edited = input.resolution === "edit_approve" && input.edited ? input.edited : null;
  const resolvedPayload = edited ?? approval.proposedAction;
  const edits = edited ? computeDiff(approval.proposedAction, edited) : [];
  const gated = { ...approval, proposedAction: resolvedPayload };

  const verdict = await runPolicyGate(gated, { demoNow, batch: input.batch });
  if (!verdict.allowed) {
    await db.update(approvals).set({ blockedReason: { rule: verdict.rule, reason: verdict.reason } }).where(eq(approvals.id, approval.id));
    await audit({
      actor: "system",
      action: "policy.blocked",
      objectType: "approval",
      objectId: approval.id,
      detail: { rule: verdict.rule, reason: verdict.reason },
    });
    return { outcome: "blocked", rule: verdict.rule, reason: verdict.reason };
  }

  const finalStatus = input.resolution === "edit_approve" ? "edited_approved" : "approved";

  // Claim before executing so a concurrent resolve can't double-execute.
  const claimed = await db
    .update(approvals)
    .set({ status: finalStatus, edits, resolvedAt: demoNow, approverUserId: userId, blockedReason: null })
    .where(and(eq(approvals.id, approval.id), eq(approvals.status, "pending")))
    .returning({ id: approvals.id });
  if (claimed.length === 0) return { outcome: "not_pending" };

  const agentName = await agentNameForRun(approval.runId);
  try {
    const result = await executeApproval({ ...approval, proposedAction: resolvedPayload }, { demoNow, agentName });
    const approvedAudit = await audit({
      actor: `user:${userId}`,
      action: "approval.approved",
      objectType: "approval",
      objectId: approval.id,
      detail: { status: finalStatus, kind: approval.kind, edited: edits.length > 0 },
    });
    await audit({
      actor: `user:${userId}`,
      action: "effect.executed",
      objectType: "approval",
      objectId: approval.id,
      detail: { provider: result.provider, ref: result.ref, agent: agentName, kind: approval.kind },
    });
    return { outcome: "approved", status: finalStatus, auditId: approvedAudit.id, ref: result.ref };
  } catch (err) {
    // Provider failure — revert the claim, record the failure, execute nothing.
    await db
      .update(approvals)
      .set({ status: "pending", edits: null, resolvedAt: null, approverUserId: null })
      .where(eq(approvals.id, approval.id));
    await audit({
      actor: "system",
      action: "effect.failed",
      objectType: "approval",
      objectId: approval.id,
      detail: { kind: approval.kind, error: err instanceof Error ? err.message : String(err) },
    });
    return { outcome: "error", message: err instanceof Error ? err.message : "execution failed" };
  }
}
