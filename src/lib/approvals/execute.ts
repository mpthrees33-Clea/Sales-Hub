/**
 * Effect execution (WO-03 task 9.5). The kind → provider-effect map, called
 * ONLY by the resolution server action after the policy gate allows. Every path
 * routes through a provider or a direct DB write of a recorded effect; none of
 * this is reachable by an agent tool. Returns a `{provider, ref}` descriptor for
 * the `effect.executed` audit row.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accounts,
  activities,
  approvals,
  opportunities,
  purchaseOrders,
  quotes,
  sampleOrders,
  submittalPackages,
  type Address,
  type QuoteLine,
  type SalesOrderLine,
  type SampleItem,
} from "@/db/schema";
import { getEmailProvider, getErpProvider } from "@/providers";

type ApprovalRow = typeof approvals.$inferSelect;
export type ExecuteResult = { provider: string; ref: string };
export type ExecuteCtx = { demoNow: Date; agentName: string | null };

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

async function accountAddress(accountId: string): Promise<Address | null> {
  const row = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  return row?.address ?? null;
}

async function sendEmail(p: Record<string, unknown>): Promise<ExecuteResult> {
  const email = getEmailProvider();
  const { draftId } = await email.createDraft({
    to: asArray<string>(p.to),
    cc: asArray<string>(p.cc),
    subject: typeof p.subject === "string" ? p.subject : "(no subject)",
    bodyText: typeof p.bodyText === "string" ? p.bodyText : typeof p.note === "string" ? p.note : "",
    attachmentAssetIds: asArray<string>(p.attachmentAssetIds),
    inReplyToEmailId: typeof p.inReplyToEmailId === "string" ? p.inReplyToEmailId : undefined,
    threadId: typeof p.threadId === "string" ? p.threadId : undefined,
  });
  const { sentEmailId } = await email.send(draftId);
  return { provider: "email", ref: sentEmailId };
}

/**
 * Execute the resolved (possibly edited) proposed_action for one approval.
 * DB-local writes only — provider failure throws and the caller rolls back
 * status (never partial-executes).
 */
export async function executeApproval(approval: ApprovalRow, ctx: ExecuteCtx): Promise<ExecuteResult> {
  const p = approval.proposedAction;

  switch (approval.kind) {
    case "email_draft":
      return sendEmail(p);

    case "scene_send":
      // Generic outbound: the scene note goes out as a message to the contact.
      return sendEmail(p);

    case "quote": {
      const lines = asArray<QuoteLine>(p.lines);
      const subtotalCents = typeof p.subtotalCents === "number" ? p.subtotalCents : lines.reduce((a, l) => a + l.extendedCents, 0);
      const totalCents = typeof p.totalCents === "number" ? p.totalCents : subtotalCents;
      const number = typeof p.quoteNumber === "string" ? p.quoteNumber : await getErpProvider().nextNumber("Q");
      const [row] = await db
        .insert(quotes)
        .values({
          accountId: String(p.accountId),
          opportunityId: typeof p.opportunityId === "string" ? p.opportunityId : null,
          number,
          status: "sent",
          lines,
          subtotalCents,
          totalCents,
          validUntil: typeof p.validUntil === "string" ? p.validUntil : null,
        })
        .returning({ id: quotes.id });
      return { provider: "erp", ref: number + " (" + row!.id.slice(0, 8) + ")" };
    }

    case "sales_order": {
      const lines = asArray<SalesOrderLine>(p.lines);
      const subtotalCents = typeof p.subtotalCents === "number" ? p.subtotalCents : lines.reduce((a, l) => a + l.extendedCents, 0);
      const totalCents = typeof p.totalCents === "number" ? p.totalCents : subtotalCents;
      const erp = getErpProvider();
      const { number } = await erp.createSalesOrder({
        poId: typeof p.poId === "string" ? p.poId : undefined,
        accountId: String(p.accountId),
        lines,
        subtotalCents,
        totalCents,
      });
      // Convert the backing PO if one is linked.
      if (typeof p.poId === "string") {
        await db.update(purchaseOrders).set({ status: "converted" }).where(eq(purchaseOrders.id, p.poId));
      }
      return { provider: "erp", ref: number };
    }

    case "sample_order": {
      const items = asArray<Record<string, unknown>>(p.items).map(
        (i): SampleItem => ({ productId: String(i.productId), size: (i.size as SampleItem["size"]) ?? "8x10", qty: typeof i.qty === "number" ? i.qty : 1 }),
      );
      const accountId = String(p.accountId);
      const onFile = await accountAddress(accountId);
      const shipTo: Address & { source?: "email" | "account_on_file" } = onFile
        ? { ...onFile, source: "account_on_file" }
        : { line1: "", city: "", state: "", zip: "", source: "account_on_file" };
      const [row] = await db
        .insert(sampleOrders)
        .values({
          accountId,
          contactId: typeof p.contactId === "string" ? p.contactId : null,
          items,
          shipTo,
          status: "ordered",
          orderedAt: ctx.demoNow,
        })
        .returning({ id: sampleOrders.id });
      return { provider: "erp", ref: "sample:" + row!.id.slice(0, 8) };
    }

    case "opportunity_update": {
      // Apply field deltas to an existing opportunity when referenced…
      const oppId = typeof p.opportunityId === "string" ? p.opportunityId : null;
      const diffs = asArray<{ field: string; old: unknown; new: unknown }>(p.fieldDiffs);
      if (oppId) {
        const set: Record<string, unknown> = {};
        for (const d of diffs) {
          if (d.field === "stage") set.stage = d.new;
          else if (d.field === "value" || d.field === "valueCents") set.valueCents = d.new;
          else if (d.field === "probability") set.probability = d.new;
          else if (d.field === "next_step" || d.field === "nextStep") set.nextStep = d.new;
          else if (d.field === "expected_close" || d.field === "expectedClose") set.expectedClose = d.new;
        }
        if (Object.keys(set).length > 0) {
          await db.update(opportunities).set(set).where(eq(opportunities.id, oppId));
        }
      }
      // …and/or create a proposed new opportunity.
      let createdRef = oppId ?? "";
      const nw = p.newOpportunity as Record<string, unknown> | undefined;
      if (nw && typeof nw.name === "string") {
        const [row] = await db
          .insert(opportunities)
          .values({
            accountId: String(p.accountId),
            name: nw.name,
            stage: (nw.stage as typeof opportunities.$inferInsert.stage) ?? "lead",
            valueCents: typeof nw.valueCents === "number" ? nw.valueCents : 0,
            probability: typeof nw.probability === "number" ? nw.probability : 20,
          })
          .returning({ id: opportunities.id });
        createdRef = row!.id;
      }
      await db.insert(activities).values({
        type: "note",
        accountId: typeof p.accountId === "string" ? p.accountId : null,
        opportunityId: createdRef || null,
        refType: "approval",
        refId: approval.id,
        summary: typeof p.rationale === "string" ? p.rationale : "Opportunity updated from approval",
        detail: { diffs },
        occurredAt: ctx.demoNow,
      });
      return { provider: "crm", ref: "opp:" + (createdRef ? createdRef.slice(0, 8) : "updated") };
    }

    case "submittal": {
      const sections = asArray<Record<string, unknown>>(p.sections);
      const [row] = await db
        .insert(submittalPackages)
        .values({
          projectId: String(p.projectId),
          name: typeof p.packageTitle === "string" ? p.packageTitle : "Submittal Package",
          productIds: [],
          sections: sections as never,
          status: "approved",
        })
        .returning({ id: submittalPackages.id });
      return { provider: "assets", ref: "submittal:" + row!.id.slice(0, 8) };
    }
  }
}
