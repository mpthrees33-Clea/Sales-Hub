/**
 * Sample-order runners + status progression (WO-09). The agent path claims a
 * routing, runs the agent (which creates the pending order + approvals), and
 * completes the routing. progressSampleOrders advances ordered→shipped→delivered
 * off the demo clock, idempotently. Both are called by WO-08's nightly run.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { sampleOrders } from "@/db/schema";
import { audit } from "@/lib/audit";
import { claimRoutingById, completeRouting, releaseRouting } from "@/lib/routing";
import { sampleOrderAgent } from "@/agents/sample-order";

export async function runSampleOrder(threadId: string, emailId: string, trigger: "user" | "nightly" | "workflow" = "user") {
  return sampleOrderAgent.run({ threadId, emailId }, { trigger });
}

export async function runSampleFromRouting(routingId: string): Promise<{ status: string; runId?: string; approvals?: number }> {
  const claimed = await claimRoutingById(routingId);
  if (!claimed) return { status: "skipped" };
  const payload = (claimed.payload ?? {}) as { threadId?: string };
  try {
    const run = await runSampleOrder(payload.threadId ?? claimed.threadId, claimed.emailId, "nightly");
    await completeRouting(routingId, run.runId);
    return { status: run.status, runId: run.runId, approvals: run.approvalIds.length };
  } catch (err) {
    await releaseRouting(routingId);
    throw err;
  }
}

const DAY = 86_400_000;

/** Advance sample orders off the demo clock: ordered→shipped (+1d), shipped→delivered (+3d). Idempotent. */
export async function progressSampleOrders(demoNow: Date): Promise<{ shipped: number; delivered: number }> {
  const toShip = await db
    .select({ id: sampleOrders.id, orderedAt: sampleOrders.orderedAt })
    .from(sampleOrders)
    .where(and(eq(sampleOrders.status, "ordered"), isNull(sampleOrders.shippedAt)));
  let shipped = 0;
  for (const s of toShip) {
    if (s.orderedAt && s.orderedAt.getTime() + DAY <= demoNow.getTime()) {
      await db.update(sampleOrders).set({ status: "shipped", shippedAt: demoNow }).where(and(eq(sampleOrders.id, s.id), eq(sampleOrders.status, "ordered")));
      await audit({ actor: "system", action: "sample.shipped", objectType: "sample_order", objectId: s.id });
      shipped++;
    }
  }

  const toDeliver = await db
    .select({ id: sampleOrders.id, orderedAt: sampleOrders.orderedAt })
    .from(sampleOrders)
    .where(and(eq(sampleOrders.status, "shipped"), isNull(sampleOrders.deliveredAt)));
  let delivered = 0;
  for (const s of toDeliver) {
    if (s.orderedAt && s.orderedAt.getTime() + 3 * DAY <= demoNow.getTime()) {
      await db.update(sampleOrders).set({ status: "delivered", deliveredAt: demoNow }).where(and(eq(sampleOrders.id, s.id), eq(sampleOrders.status, "shipped")));
      await audit({ actor: "system", action: "sample.delivered", objectType: "sample_order", objectId: s.id });
      delivered++;
    }
  }
  return { shipped, delivered };
}
