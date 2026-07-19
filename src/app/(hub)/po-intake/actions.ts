"use server";

/**
 * Escalation resolution (WO-06 task 13) — human-only, audit-logged, no
 * agent involvement. Edit the offending extracted values → deterministically
 * re-run layers 1–7 (new validation steps, human diff recorded on the
 * approval); or reject → PO stays escalated, approval rejected.
 */
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, purchaseOrders } from "@/db/schema";
import { diffProposedAction } from "@/lib/approvals/diff";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import {
  finalizePo,
  reparseExtraction,
  validateExtraction,
} from "@/app/api/workflows/po-intake/workflow";

export async function resolveEscalatedPo(input: {
  poId: string;
  editedExtraction: Record<string, unknown>;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const session = await requireSession();
  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, input.poId) });
  if (!po) return { ok: false, error: "PO not found" };
  if (po.status !== "escalated") return { ok: false, error: `PO is ${po.status}, not escalated` };

  let extraction;
  try {
    extraction = reparseExtraction(input.editedExtraction);
  } catch (e) {
    return { ok: false, error: `edited extraction is invalid: ${e instanceof Error ? e.message : e}` };
  }

  const editDiffs = diffProposedAction(stripMeta(po.extracted ?? {}), stripMeta(input.editedExtraction));
  const runId = await latestRunIdForPo(po.id);

  const outcome = await validateExtraction(po.id, extraction, runId);

  // Reuse the pending approval so the human diff lands on it.
  const pending = await db.query.approvals.findFirst({
    where: and(eq(approvals.status, "pending"), sql`${approvals.proposedAction} ->> 'poId' = ${po.id}`),
  });
  const result = await finalizePo({
    poId: po.id,
    runId,
    t0: Date.now(),
    extraction,
    resolvedLines: outcome.resolvedLines,
    accountId: outcome.accountId,
    results: outcome.results,
    blobUrl: po.blobUrl,
    existingApprovalId: pending?.id,
  });
  if (pending && editDiffs.length > 0) {
    await db.update(approvals).set({ edits: editDiffs }).where(eq(approvals.id, pending.id));
  }
  await audit({
    actor: `user:${session.userId}`,
    action: "po.resolution.edited",
    objectType: "purchase_order",
    objectId: po.id,
    detail: { editCount: editDiffs.length, resultStatus: result.status },
  });
  revalidatePath(`/po-intake/${po.id}`);
  revalidatePath("/po-intake");
  revalidatePath("/approvals");
  return { ok: true, status: result.status };
}

export async function rejectEscalatedPo(poId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) });
  if (!po) return { ok: false, error: "PO not found" };
  const pending = await db.query.approvals.findFirst({
    where: and(eq(approvals.status, "pending"), sql`${approvals.proposedAction} ->> 'poId' = ${poId}`),
  });
  if (pending) {
    await db
      .update(approvals)
      .set({ status: "rejected", resolvedAt: sql`now()`, approverUserId: session.userId })
      .where(eq(approvals.id, pending.id));
  }
  await audit({
    actor: `user:${session.userId}`,
    action: "po.resolution.rejected",
    objectType: "purchase_order",
    objectId: poId,
  });
  revalidatePath(`/po-intake/${poId}`);
  revalidatePath("/approvals");
  return { ok: true };
}

function stripMeta(v: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
  delete clone.__meta;
  return clone;
}

async function latestRunIdForPo(poId: string): Promise<string | null> {
  const { agentRuns } = await import("@/db/schema");
  const run = await db.query.agentRuns.findFirst({
    where: and(eq(agentRuns.agentName, "po-intake"), sql`${agentRuns.input} ->> 'blobUrl' in (select blob_url from purchase_orders where id = ${poId})`),
    orderBy: (t, { desc }) => desc(t.startedAt),
  });
  return run?.id ?? null;
}
