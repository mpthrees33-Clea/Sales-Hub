/**
 * Approval resolution core (WO-03 task 9) — THE only code path that executes
 * external effects (docs/02 §2.1). Extracted from the server action so it is
 * independent of the Next request context and therefore directly unit-testable
 * end to end (the action in app/(hub)/approvals/actions.ts only adds
 * requireSession() + revalidatePath()). No agent tool can reach this.
 *
 * Guarantees:
 *  - rejecting/expiring never calls the gate or a provider (no side effects);
 *  - the deterministic policy gate re-runs here at execution time against the
 *    resolved (possibly human-edited) payload;
 *  - the pending→resolved transition is an atomic claim (UPDATE … WHERE
 *    status='pending' RETURNING), so a concurrent resolve can't double-execute;
 *  - a provider failure rolls the claim back to pending and records
 *    `effect.failed` — the approval never partial-executes.
 *
 * Effect execution itself stays in ./execute (the richer kind→effect map:
 * submittal → attachable asset + transmittal draft, opportunity field aliases,
 * quote/SO/sample writes). ./execute writes the `effect.executed` audit row
 * that feeds the gate's rate caps, so this core does not duplicate it.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agentRuns, approvals } from "@/db/schema";
import { diffProposedAction } from "@/lib/approvals/diff";
import { executeApproval } from "@/lib/approvals/execute";
import { isExpired } from "@/lib/approvals/expiry";
import { audit } from "@/lib/audit";
import { getDemoNow } from "@/lib/demo-clock";
import { runPolicyGate } from "@/harness/policy-gate";
import { shortId } from "@/lib/utils";

export type Resolution = "approve" | "edit_approve" | "reject";

export type ResolveInput = {
  id: string;
  resolution: Resolution;
  edited?: Record<string, unknown>;
  batch?: boolean;
};

export type ResolveResult =
  | { outcome: "approved"; auditRef: string; description: string }
  | { outcome: "rejected" }
  | { outcome: "expired" }
  | { outcome: "blocked"; rule: string; reason: string }
  | { outcome: "error"; message: string };

async function agentNameForRun(runId: string | null): Promise<string | null> {
  if (!runId) return null;
  const [run] = await db
    .select({ agentName: agentRuns.agentName })
    .from(agentRuns)
    .where(eq(agentRuns.id, runId));
  return run?.agentName ?? null;
}

/**
 * Resolve one approval on behalf of `userId`. Returns a UI-facing outcome; the
 * server action maps these straight to toasts. Never throws for expected
 * outcomes — unexpected errors are audited as `effect.failed` and returned as
 * `{ outcome: "error" }`.
 */
export async function resolveApprovalCore(input: ResolveInput, userId: string): Promise<ResolveResult> {
  const demoNow = await getDemoNow();

  try {
    const row = await db.query.approvals.findFirst({ where: eq(approvals.id, input.id) });
    if (!row) return { outcome: "error", message: "approval not found" };
    if (row.status !== "pending") return { outcome: "error", message: `approval is ${row.status}, not pending` };

    // Expiry — a stale approval is never executed. Claim atomically.
    if (isExpired(row, demoNow)) {
      const claimed = await db
        .update(approvals)
        .set({ status: "expired" })
        .where(and(eq(approvals.id, row.id), eq(approvals.status, "pending")))
        .returning({ id: approvals.id });
      if (claimed.length === 0) return { outcome: "error", message: "approval is no longer pending" };
      await audit({
        actor: `user:${userId}`,
        action: "approval.expired",
        objectType: "approval",
        objectId: row.id,
        detail: { kind: row.kind, at: "resolution" },
      });
      return { outcome: "expired" };
    }

    // Reject — no gate call, no provider call, no side effects.
    if (input.resolution === "reject") {
      const claimed = await db
        .update(approvals)
        .set({ status: "rejected", resolvedAt: sql`now()`, approverUserId: userId })
        .where(and(eq(approvals.id, row.id), eq(approvals.status, "pending")))
        .returning({ id: approvals.id });
      if (claimed.length === 0) return { outcome: "error", message: "approval is no longer pending" };
      await audit({
        actor: `user:${userId}`,
        action: "approval.rejected",
        objectType: "approval",
        objectId: row.id,
        detail: { kind: row.kind },
      });
      return { outcome: "rejected" };
    }

    // Approve / edit-approve — resolve the (possibly edited) payload.
    const isEdit = input.resolution === "edit_approve";
    const payload = isEdit && input.edited ? input.edited : row.proposedAction;
    const edits = isEdit ? diffProposedAction(row.proposedAction, payload) : [];

    // Deterministic policy gate — at execution time, on the resolved payload.
    const verdict = await runPolicyGate({ ...row, proposedAction: payload }, { demoNow, batch: input.batch });
    if (!verdict.allowed) {
      await db
        .update(approvals)
        .set({ blockedReason: { rule: verdict.rule, reason: verdict.reason } })
        .where(eq(approvals.id, row.id));
      await audit({
        actor: `user:${userId}`,
        action: "policy.blocked",
        objectType: "approval",
        objectId: row.id,
        detail: { rule: verdict.rule, reason: verdict.reason, kind: row.kind },
      });
      return { outcome: "blocked", rule: verdict.rule, reason: verdict.reason };
    }

    const finalStatus = isEdit ? "edited_approved" : "approved";

    // Claim before executing so a concurrent resolve can't double-execute.
    const claimed = await db
      .update(approvals)
      .set({
        status: finalStatus,
        proposedAction: payload,
        edits: edits.length > 0 ? edits : null,
        blockedReason: null,
        resolvedAt: sql`now()`,
        approverUserId: userId,
      })
      .where(and(eq(approvals.id, row.id), eq(approvals.status, "pending")))
      .returning({ id: approvals.id });
    if (claimed.length === 0) return { outcome: "error", message: "approval is no longer pending" };

    const agentName = await agentNameForRun(row.runId);
    try {
      // ./execute runs the effect through the provider layer AND writes the
      // `effect.executed` audit row (rate-cap accounting) — do not duplicate it.
      const exec = await executeApproval(row, payload, agentName);
      const auditRow = await audit({
        actor: `user:${userId}`,
        action: "approval.approved",
        objectType: "approval",
        objectId: row.id,
        detail: { kind: row.kind, edited: isEdit, editCount: edits.length, effectRef: exec.ref },
      });
      return { outcome: "approved", auditRef: shortId(auditRow.id), description: exec.description };
    } catch (err) {
      // Provider failure — revert the claim (restore the original payload),
      // record the failure, execute nothing further.
      await db
        .update(approvals)
        .set({
          status: "pending",
          proposedAction: row.proposedAction,
          edits: null,
          blockedReason: null,
          resolvedAt: null,
          approverUserId: null,
        })
        .where(eq(approvals.id, row.id));
      const message = err instanceof Error ? err.message : String(err);
      await audit({
        actor: "system",
        action: "effect.failed",
        objectType: "approval",
        objectId: row.id,
        detail: { kind: row.kind, error: message },
      });
      return { outcome: "error", message };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await audit({
      actor: "system",
      action: "effect.failed",
      objectType: "approval",
      objectId: input.id,
      detail: { error: message },
    });
    return { outcome: "error", message };
  }
}
