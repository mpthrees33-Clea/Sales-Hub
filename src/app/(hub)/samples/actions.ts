"use server";

/** Sample-order server actions (WO-09): manual compose + demo-clock progression. */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, sampleOrders, type SampleItem } from "@/db/schema";
import { createApprovalRow } from "@/harness/approvals";
import { requireSession } from "@/lib/auth";
import { getDemoNow } from "@/lib/demo-clock";
import { progressSampleOrders } from "@/lib/samples";

export async function createManualSampleOrder(input: {
  accountId: string;
  contactId: string;
  items: SampleItem[];
}): Promise<{ approvalId: string; sampleOrderId: string }> {
  await requireSession();
  const demoNow = await getDemoNow();
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, input.accountId) });
  const shipTo = account ? { ...account.address, source: "account_on_file" as const } : { line1: "", city: "", state: "", zip: "", source: "account_on_file" as const };

  const [row] = await db
    .insert(sampleOrders)
    .values({ accountId: input.accountId, contactId: input.contactId, items: input.items, shipTo, status: "pending_approval" })
    .returning({ id: sampleOrders.id });

  const { approvalId } = await createApprovalRow({
    runId: null,
    agentName: "manual-compose",
    kind: "sample_order",
    proposedAction: { sampleOrderId: row!.id, accountId: input.accountId, contactId: input.contactId, items: input.items, shipTo },
    evidence: [],
    demoNow,
    riskTier: "low",
  });

  revalidatePath("/samples");
  revalidatePath("/approvals");
  return { approvalId, sampleOrderId: row!.id };
}

export async function progressSamplesAction(): Promise<{ shipped: number; delivered: number }> {
  await requireSession();
  const r = await progressSampleOrders(await getDemoNow());
  if (r.shipped + r.delivered > 0) revalidatePath("/samples");
  return r;
}
