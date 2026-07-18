"use server";

/**
 * Approval resolution — THE only code path that executes external effects
 * (docs/02 §2.1, WO-03 task 9). Authenticated; loads FOR UPDATE; checks
 * expiry; re-runs the deterministic policy gate at execution time against
 * the resolved (possibly human-edited) payload; executes through the
 * provider layer; audits every outcome. Rejecting never executes. No agent
 * tool can reach this action.
 */
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agentRuns, approvals } from "@/db/schema";
import { diffProposedAction } from "@/lib/approvals/diff";
import { executeApproval } from "@/lib/approvals/execute";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { getDemoNow } from "@/lib/demo-clock";
import { shortId } from "@/lib/utils";
import { runPolicyGate } from "@/harness/policy-gate";

export type ResolveResult =
  | { outcome: "approved"; auditRef: string; description: string }
  | { outcome: "rejected" }
  | { outcome: "expired" }
  | { outcome: "blocked"; rule: string; reason: string }
  | { outcome: "error"; message: string };

export async function resolveApproval(input: {
  id: string;
  resolution: "approve" | "edit_approve" | "reject";
  edited?: Record<string, unknown>;
  batch?: boolean;
}): Promise<ResolveResult> {
  const session = await requireSession();
  const demoNow = await getDemoNow();

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(approvals)
        .where(eq(approvals.id, input.id))
        .for("update");
      if (!row) return { outcome: "error", message: "approval not found" } as const;
      if (row.status !== "pending") {
        return { outcome: "error", message: `approval is ${row.status}, not pending` } as const;
      }

      // Expiry check — expired approvals never execute.
      if (row.expiresDemoAt.getTime() < demoNow.getTime()) {
        await tx.update(approvals).set({ status: "expired" }).where(eq(approvals.id, row.id));
        await audit({
          actor: `user:${session.userId}`,
          action: "approval.expired",
          objectType: "approval",
          objectId: row.id,
          detail: { kind: row.kind, at: "resolution" },
        });
        return { outcome: "expired" } as const;
      }

      // Reject: no gate call, no provider call, no side effects.
      if (input.resolution === "reject") {
        await tx
          .update(approvals)
          .set({ status: "rejected", resolvedAt: sql`now()`, approverUserId: session.userId })
          .where(eq(approvals.id, row.id));
        await audit({
          actor: `user:${session.userId}`,
          action: "approval.rejected",
          objectType: "approval",
          objectId: row.id,
          detail: { kind: row.kind },
        });
        revalidatePath("/approvals");
        return { outcome: "rejected" } as const;
      }

      const isEdit = input.resolution === "edit_approve";
      const payload = isEdit && input.edited ? input.edited : row.proposedAction;
      const edits = isEdit ? diffProposedAction(row.proposedAction, payload) : [];

      // Deterministic policy gate — at execution time, on the resolved payload.
      const verdict = await runPolicyGate({ ...row, proposedAction: payload }, { demoNow, batch: input.batch });
      if (!verdict.allowed) {
        await tx
          .update(approvals)
          .set({ blockedReason: { rule: verdict.rule, reason: verdict.reason } })
          .where(eq(approvals.id, row.id));
        await audit({
          actor: `user:${session.userId}`,
          action: "policy.blocked",
          objectType: "approval",
          objectId: row.id,
          detail: { rule: verdict.rule, reason: verdict.reason, kind: row.kind },
        });
        revalidatePath("/approvals");
        return { outcome: "blocked", rule: verdict.rule, reason: verdict.reason } as const;
      }

      // Execute through the provider layer.
      const run = row.runId
        ? await tx.select({ agentName: agentRuns.agentName }).from(agentRuns).where(eq(agentRuns.id, row.runId))
        : [];
      const exec = await executeApproval(row, payload, run[0]?.agentName ?? null);

      await tx
        .update(approvals)
        .set({
          status: isEdit ? "edited_approved" : "approved",
          proposedAction: payload,
          edits: edits.length > 0 ? edits : null,
          blockedReason: null,
          resolvedAt: sql`now()`,
          approverUserId: session.userId,
        })
        .where(eq(approvals.id, row.id));

      const auditRow = await audit({
        actor: `user:${session.userId}`,
        action: "approval.approved",
        objectType: "approval",
        objectId: row.id,
        detail: { kind: row.kind, edited: isEdit, editCount: edits.length, effectRef: exec.ref },
      });

      revalidatePath("/approvals");
      revalidatePath("/dashboard");
      return { outcome: "approved", auditRef: shortId(auditRow.id), description: exec.description } as const;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await audit({
      actor: `user:${session.userId}`,
      action: "effect.failed",
      objectType: "approval",
      objectId: input.id,
      detail: { error: message },
    });
    return { outcome: "error", message };
  }
}

/**
 * Batch approve — low tier ONLY, enforced server-side (the gate re-runs per
 * item with batch context; one block does not halt the rest).
 */
export async function resolveApprovalsBatch(ids: string[]): Promise<{
  approved: number;
  blocked: number;
  errors: number;
}> {
  await requireSession();
  let approved = 0;
  let blocked = 0;
  let errors = 0;
  for (const id of ids) {
    const res = await resolveApproval({ id, resolution: "approve", batch: true });
    if (res.outcome === "approved") approved += 1;
    else if (res.outcome === "blocked") blocked += 1;
    else errors += 1;
  }
  return { approved, blocked, errors };
}
