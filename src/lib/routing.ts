/**
 * Triage routing contract (WO-04 task 2) — the cross-WO API that WO-05 (quote),
 * WO-06 (PO), WO-08 (nightly), WO-09 (samples), and WO-14 (submittals) consume
 * without rework. `email-triage` writes one routing row per inbound email;
 * downstream agents atomically CLAIM a routing, do their work, then COMPLETE it.
 *
 * Contract semantics:
 *  - `emails.is_processed = true` means "triaged and routed".
 *  - Downstream consumption state lives on the routing row's `status`
 *    (pending → in_progress → consumed | dismissed).
 *  - WO-08 keys idempotency off BOTH flags: it only routes unprocessed emails
 *    and only claims `pending` routings.
 */
import { and, eq } from "drizzle-orm";
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
 * Deterministic category → target map (WO-04 task 2). This lives in code and is
 * NEVER trusted from model output — the triage agent classifies, this maps.
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

/** Typed routing payloads per target (WO-04 task 2). */
export type ReplyIntent = "stock_check" | "scheduling" | "general";
export type RoutingPayload =
  | { kind: "reply"; emailId: string; threadId: string; replyIntent: ReplyIntent }
  | { kind: "quote"; emailId: string; threadId: string }
  | { kind: "sample"; emailId: string; threadId: string }
  | { kind: "submittal"; emailId: string; threadId: string }
  | { kind: "po_intake"; emailId: string; attachmentBlobUrl: string }
  | { kind: "none"; emailId: string; threadId: string };

export type RoutingRow = typeof triageRoutings.$inferSelect;

/**
 * Atomically claim one pending routing for `target`. CAS on `status='pending'`
 * guarantees exactly one winner under concurrency. Returns the claimed row or
 * null when none are available.
 */
export async function claimRouting(target: RoutingTarget, runId: string): Promise<RoutingRow | null> {
  const candidates = await db
    .select({ id: triageRoutings.id })
    .from(triageRoutings)
    .where(and(eq(triageRoutings.target, target), eq(triageRoutings.status, "pending")));
  for (const { id } of candidates) {
    const claimed = await claimRoutingById(id, runId);
    if (claimed) return claimed;
  }
  return null;
}

/**
 * Atomically claim a specific routing by id. The `WHERE status='pending'` clause
 * is the compare-and-set: two concurrent claims on the same row → one winner,
 * the other gets null.
 */
export async function claimRoutingById(id: string, runId: string): Promise<RoutingRow | null> {
  const [row] = await db
    .update(triageRoutings)
    .set({ status: "in_progress", consumedByRunId: runId })
    .where(and(eq(triageRoutings.id, id), eq(triageRoutings.status, "pending")))
    .returning();
  return row ?? null;
}

/** Mark a claimed routing consumed. Escalated runs also complete — the escalated run is the human record. */
export async function completeRouting(id: string, runId: string): Promise<void> {
  await db.update(triageRoutings).set({ status: "consumed", consumedByRunId: runId }).where(eq(triageRoutings.id, id));
}

/** Release a claimed routing back to pending after a transient failure. */
export async function releaseRouting(id: string): Promise<void> {
  await db.update(triageRoutings).set({ status: "pending", consumedByRunId: null }).where(eq(triageRoutings.id, id));
}
