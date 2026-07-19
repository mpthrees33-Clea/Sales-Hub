"use server";

/**
 * Samples server actions (WO-09): manual compose (still approval-railed —
 * one keystroke to approve, uniform audit trail) and the deterministic
 * demo-clock status progression.
 */
import { revalidatePath } from "next/cache";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, contacts, sampleOrders, type SampleItem } from "@/db/schema";
import { createApprovalRow } from "@/harness/approvals";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { getDemoNow } from "@/lib/demo-clock";

export async function createManualSampleOrder(input: {
  contactId: string;
  items: (SampleItem & { sku: string; name: string })[];
  shipTo: { line1: string; city: string; state: string; zip: string };
}): Promise<{ ok: boolean; approvalId?: string; error?: string }> {
  const session = await requireSession();
  if (input.items.length === 0) return { ok: false, error: "no items" };
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, input.contactId) });
  if (!contact) return { ok: false, error: "unknown contact" };
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, contact.accountId) });
  const demoNow = await getDemoNow();

  const [order] = await db
    .insert(sampleOrders)
    .values({
      accountId: contact.accountId,
      contactId: contact.id,
      items: input.items.map(({ productId, size, qty }) => ({ productId, size, qty })),
      shipTo: { ...input.shipTo, source: "account_on_file" as const },
      status: "pending_approval",
    })
    .returning({ id: sampleOrders.id });

  const { approvalId } = await createApprovalRow({
    runId: null,
    agentName: "rep-manual",
    kind: "sample_order",
    proposedAction: {
      sampleOrderId: order!.id,
      accountId: contact.accountId,
      accountName: account?.name ?? "",
      contactId: contact.id,
      contactName: contact.name,
      items: input.items,
      shipTo: { ...input.shipTo, source: "account_on_file" },
      note: "Rep-initiated from the catalog",
    },
    evidence: [],
    demoNow,
  });
  await audit({
    actor: `user:${session.userId}`,
    action: "sample_order.composed",
    objectType: "sample_order",
    objectId: order!.id,
    detail: { items: input.items.length },
  });
  revalidatePath("/samples");
  revalidatePath("/approvals");
  return { ok: true, approvalId };
}

/**
 * Demo-clock status progression (WO-09 task 6): ordered→shipped at +1
 * demo-day, shipped→delivered at +3 demo-days. Idempotent; each transition
 * audit-logged. Called lazily on samples page load and by the nightly run.
 */
export async function progressSampleOrders(demoNow?: Date): Promise<{ shipped: number; delivered: number }> {
  const now = demoNow ?? (await getDemoNow());
  const shipCutoff = new Date(now.getTime() - 1 * 86_400_000);
  const deliverCutoff = new Date(now.getTime() - 3 * 86_400_000);

  const shippedRows = await db
    .update(sampleOrders)
    .set({ status: "shipped", shippedAt: now })
    .where(and(eq(sampleOrders.status, "ordered"), lte(sampleOrders.orderedAt, shipCutoff), isNull(sampleOrders.shippedAt)))
    .returning({ id: sampleOrders.id });
  for (const r of shippedRows) {
    await audit({ actor: "system", action: "sample_order.shipped", objectType: "sample_order", objectId: r.id });
  }

  const deliveredRows = await db
    .update(sampleOrders)
    .set({ status: "delivered", deliveredAt: now })
    .where(
      and(eq(sampleOrders.status, "shipped"), lte(sampleOrders.shippedAt, deliverCutoff), sql`${sampleOrders.deliveredAt} is null`),
    )
    .returning({ id: sampleOrders.id });
  for (const r of deliveredRows) {
    await audit({ actor: "system", action: "sample_order.delivered", objectType: "sample_order", objectId: r.id });
  }

  return { shipped: shippedRows.length, delivered: deliveredRows.length };
}
