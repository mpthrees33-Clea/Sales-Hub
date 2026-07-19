/**
 * Expiry sweep (WO-03 task 15, docs/02 §3): pending approvals past their
 * demo-clock expiry become `expired` — never silently executed, never
 * rendered actionable.
 */
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals } from "@/db/schema";
import { audit } from "@/lib/audit";
import { getDemoNow } from "@/lib/demo-clock";

/**
 * Pure demo-clock expiry predicate — an approval is expired once its
 * `expiresDemoAt` is at or before the current demo clock. Used by the
 * resolution core to refuse execution of a stale approval, and shared with
 * the sweep so both agree on the boundary.
 */
export function isExpired(approval: { expiresDemoAt: Date }, demoNow: Date): boolean {
  return approval.expiresDemoAt.getTime() <= demoNow.getTime();
}

export async function sweepExpiredApprovals(): Promise<number> {
  const demoNow = await getDemoNow();
  const expired = await db
    .update(approvals)
    .set({ status: "expired" })
    .where(and(eq(approvals.status, "pending"), lt(approvals.expiresDemoAt, demoNow)))
    .returning({ id: approvals.id, kind: approvals.kind });
  for (const row of expired) {
    await audit({
      actor: "system",
      action: "approval.expired",
      objectType: "approval",
      objectId: row.id,
      detail: { kind: row.kind },
    });
  }
  return expired.length;
}
