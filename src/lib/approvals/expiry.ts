/**
 * Approval expiry (WO-03 tasks 9.2 & 15). Approvals expire a fixed number of
 * demo-clock hours after creation (POLICY_CONFIG.approvalExpiryHours, default
 * 72). Expired approvals never execute; the queue sweeps them to `expired` on
 * load so stale items never render as actionable. All time math is on the demo
 * clock — never `new Date()`.
 */
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals } from "@/db/schema";
import { audit } from "@/lib/audit";

type ApprovalRow = typeof approvals.$inferSelect;

export function isExpired(approval: Pick<ApprovalRow, "expiresDemoAt">, demoNow: Date): boolean {
  return approval.expiresDemoAt.getTime() <= demoNow.getTime();
}

/**
 * Move every still-pending approval whose expiry has passed to `expired` and
 * write one audit row each. Returns the count swept. Called on queue load.
 */
export async function sweepExpired(demoNow: Date): Promise<number> {
  const stale = await db
    .select({ id: approvals.id })
    .from(approvals)
    .where(and(eq(approvals.status, "pending"), lt(approvals.expiresDemoAt, demoNow)));
  if (stale.length === 0) return 0;

  for (const { id } of stale) {
    await db
      .update(approvals)
      .set({ status: "expired", resolvedAt: demoNow })
      .where(and(eq(approvals.id, id), eq(approvals.status, "pending")));
    await audit({
      actor: "system",
      action: "approval.expired",
      objectType: "approval",
      objectId: id,
    });
  }
  return stale.length;
}
