/**
 * The triage routing contract (WO-04 task 2) — the cross-WO API consumed by
 * WO-05 (quote), WO-06 (PO intake), WO-08 (nightly fan-out), WO-09 (samples),
 * and WO-14 (submittals). Do not reimplement these semantics downstream.
 *
 * Contract semantics:
 * - `emails.is_processed = true` means "triaged and routed". Downstream
 *   consumption state lives on the routing row (`triage_routings.status`).
 * - WO-08 keys its idempotency off BOTH: a second nightly pass sees no
 *   unprocessed emails and no pending routings, so it is a no-op.
 * - Escalated consumer runs still `completeRouting` — the escalated
 *   agent_run + its approval are the human-facing record; the routing must
 *   not be retried automatically.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { triageRoutings } from "@/db/schema";

export type TriageCategory =
  | "quote_request"
  | "stock_check"
  | "po"
  | "sample_request"
  | "submittal_request"
  | "scheduling"
  | "general"
  | "noise";

export type RoutingTarget = "quote" | "po_intake" | "sample" | "reply" | "submittal" | "none";

/**
 * Deterministic category→target map — in code, never model output.
 * quote_request→quote · po→po_intake · sample_request→sample ·
 * stock_check|scheduling|general→reply · submittal_request→submittal ·
 * noise→none.
 */
export function categoryToTarget(category: TriageCategory): RoutingTarget {
  switch (category) {
    case "quote_request":
      return "quote";
    case "po":
      return "po_intake";
    case "sample_request":
      return "sample";
    case "stock_check":
    case "scheduling":
    case "general":
      return "reply";
    case "submittal_request":
      return "submittal";
    case "noise":
      return "none";
  }
}

/** Typed routing payloads per target (docs/work-orders/WO-04 task 2). */
export type RoutingPayload =
  | { target: "quote" | "reply" | "sample" | "submittal"; emailId: string; threadId: string; replyIntent?: "stock_check" | "scheduling" | "general" }
  | { target: "po_intake"; emailId: string; threadId: string; attachmentBlobUrl: string }
  | { target: "none"; emailId: string; threadId: string };

export type RoutingRow = typeof triageRoutings.$inferSelect;

/**
 * Atomically claim the oldest pending routing for a target. Exactly one
 * concurrent claimant wins (UPDATE … WHERE status='pending' … RETURNING).
 */
export async function claimRouting(target: RoutingTarget, runId: string | null): Promise<RoutingRow | null> {
  const rows = await db.execute(sql`
    UPDATE triage_routings SET status = 'in_progress', consumed_by_run_id = ${runId}, updated_at = now()
    WHERE id = (
      SELECT id FROM triage_routings
      WHERE status = 'pending' AND target = ${target}
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return (rows.rows[0] as RoutingRow | undefined) ? normalizeRow(rows.rows[0] as Record<string, unknown>) : null;
}

/** Atomically claim a specific routing by id (manual "Draft quote" buttons). */
export async function claimRoutingById(id: string, runId: string | null): Promise<RoutingRow | null> {
  const rows = await db.execute(sql`
    UPDATE triage_routings SET status = 'in_progress', consumed_by_run_id = ${runId}, updated_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `);
  return (rows.rows[0] as RoutingRow | undefined) ? normalizeRow(rows.rows[0] as Record<string, unknown>) : null;
}

/** Mark a claimed routing consumed (also for escalated runs — see contract). */
export async function completeRouting(id: string, runId: string | null): Promise<void> {
  await db
    .update(triageRoutings)
    .set({ status: "consumed", consumedByRunId: runId })
    .where(eq(triageRoutings.id, id));
}

/** Release a claimed routing back to pending after a transient failure. */
export async function releaseRouting(id: string): Promise<void> {
  await db
    .update(triageRoutings)
    .set({ status: "pending", consumedByRunId: null })
    .where(and(eq(triageRoutings.id, id), eq(triageRoutings.status, "in_progress")));
}

export async function pendingRoutings(target?: RoutingTarget): Promise<RoutingRow[]> {
  return db.query.triageRoutings.findMany({
    where: target
      ? and(eq(triageRoutings.status, "pending"), eq(triageRoutings.target, target))
      : eq(triageRoutings.status, "pending"),
    orderBy: (t, { asc }) => asc(t.createdAt),
  });
}

/** Raw SQL rows come back snake_case; normalize to the drizzle shape. */
function normalizeRow(r: Record<string, unknown>): RoutingRow {
  return {
    id: r.id,
    emailId: r.email_id,
    threadId: r.thread_id,
    category: r.category,
    confidence: r.confidence,
    target: r.target,
    status: r.status,
    consumedByRunId: r.consumed_by_run_id,
    payload: r.payload,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  } as RoutingRow;
}
