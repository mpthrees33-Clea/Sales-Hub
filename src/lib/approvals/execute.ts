/**
 * Effect execution (WO-03 task 9.5) — the kind→effect map called ONLY by the
 * approval-resolution server action, after the human click and after the
 * policy gate allows. Everything flows through the provider layer; every
 * execution writes an `effect.executed` audit row (which also feeds the
 * policy gate's rate caps).
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activities,
  approvals,
  opportunities,
  purchaseOrders,
  quotes,
  salesOrders,
  sampleOrders,
  submittalPackages,
  type SalesOrderLine,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { getDemoNow } from "@/lib/demo-clock";
import { getEmailProvider, getErpProvider } from "@/providers";

type ApprovalRow = typeof approvals.$inferSelect;

export type ExecutionResult = { provider: string; ref: string; description: string };

export async function executeApproval(
  approval: ApprovalRow,
  payload: Record<string, unknown>,
  agentName: string | null,
): Promise<ExecutionResult> {
  const demoNow = await getDemoNow();
  let result: ExecutionResult;

  switch (approval.kind) {
    case "email_draft": {
      result = await executeEmailDraft(payload);
      break;
    }
    case "quote": {
      const number = typeof payload.quoteNumber === "string" ? payload.quoteNumber : null;
      if (number) {
        await db.update(quotes).set({ status: "sent" }).where(eq(quotes.number, number));
      }
      // A quote approval that embeds a reply draft also sends it.
      if (Array.isArray(payload.to) && payload.to.length > 0) {
        result = await executeEmailDraft(payload);
      } else {
        result = { provider: "erp", ref: number ?? approval.id, description: "quote released" };
      }
      break;
    }
    case "sales_order": {
      const erp = getErpProvider();
      let soId = typeof payload.salesOrderId === "string" ? payload.salesOrderId : null;
      let soNumber = typeof payload.salesOrderNumber === "string" ? payload.salesOrderNumber : null;
      if (!soId) {
        const created = await erp.createSalesOrder({
          poId: typeof payload.poId === "string" ? payload.poId : undefined,
          accountId: String(payload.accountId),
          lines: (payload.lines ?? []) as SalesOrderLine[],
          subtotalCents: Number(payload.subtotalCents ?? 0),
          totalCents: Number(payload.totalCents ?? 0),
        });
        soId = created.salesOrderId;
        soNumber = created.number;
      }
      await db.update(salesOrders).set({ status: "confirmed" }).where(eq(salesOrders.id, soId));
      if (typeof payload.poId === "string") {
        await db.update(purchaseOrders).set({ status: "converted" }).where(eq(purchaseOrders.id, payload.poId));
      }
      result = { provider: "erp", ref: soNumber ?? soId, description: "sales order confirmed" };
      break;
    }
    case "sample_order": {
      let sampleId = typeof payload.sampleOrderId === "string" ? payload.sampleOrderId : null;
      if (!sampleId) {
        const [row] = await db
          .insert(sampleOrders)
          .values({
            accountId: String(payload.accountId),
            contactId: typeof payload.contactId === "string" ? payload.contactId : null,
            items: (payload.items ?? []) as (typeof sampleOrders.$inferInsert)["items"],
            shipTo: (payload.shipTo ?? {}) as (typeof sampleOrders.$inferInsert)["shipTo"],
            status: "ordered",
            sourceEmailId: typeof payload.sourceEmailId === "string" ? payload.sourceEmailId : null,
            orderedAt: demoNow,
          })
          .returning({ id: sampleOrders.id });
        sampleId = row!.id;
      } else {
        await db
          .update(sampleOrders)
          .set({ status: "ordered", orderedAt: demoNow })
          .where(eq(sampleOrders.id, sampleId));
      }
      result = { provider: "erp", ref: sampleId, description: "sample order placed" };
      break;
    }
    case "opportunity_update": {
      result = await executeOpportunityUpdate(payload, demoNow);
      break;
    }
    case "submittal": {
      const pkgId = typeof payload.submittalPackageId === "string" ? payload.submittalPackageId : null;
      if (pkgId) {
        await db.update(submittalPackages).set({ status: "approved" }).where(eq(submittalPackages.id, pkgId));
      }
      // WO-14 task 4: the assembled PDF becomes an attachable asset on
      // approve, then the optional transmittal draft (a SECOND approval,
      // never a send) can reference it legally through the origin check.
      let assetNote = "";
      const blobUrl = typeof payload.outputBlobUrl === "string" ? payload.outputBlobUrl : null;
      if (pkgId && blobUrl) {
        const { registerAsset } = await import("@/lib/assets");
        const { assetId } = await registerAsset({
          kind: "submittal",
          title: `${String(payload.packageTitle ?? "Submittal package")} (${String(payload.submittalNumber ?? "")})`.trim(),
          blobUrl,
          contentType: "application/pdf",
          tags: ["submittal"],
          productIds: Array.isArray(payload.productIds) ? (payload.productIds as string[]) : [],
          actor: "system",
        });
        assetNote = " · registered as attachable asset";
        const t = payload.transmittal as
          | { to?: string[]; subject?: string; bodyText?: string; inReplyToEmailId?: string }
          | undefined;
        if (Array.isArray(t?.to) && t.to.length > 0) {
          const { createApprovalRow } = await import("@/harness/approvals");
          await createApprovalRow({
            runId: approval.runId,
            agentName: agentName ?? "submittal",
            kind: "email_draft",
            proposedAction: {
              to: t.to,
              subject: t.subject ?? "Submittal package",
              bodyText: t.bodyText ?? "Submittal package attached.",
              attachmentAssetIds: [assetId],
              inReplyToEmailId: t.inReplyToEmailId,
              intent: "submittal_transmittal",
            },
            evidence: approval.evidence ?? [],
            demoNow,
          });
          assetNote += " · transmittal draft queued";
        }
      }
      result = {
        provider: "erp",
        ref: typeof payload.submittalNumber === "string" ? payload.submittalNumber : (pkgId ?? approval.id),
        description: `submittal package approved${assetNote}`,
      };
      break;
    }
    case "scene_send": {
      if (Array.isArray(payload.to) && payload.to.length > 0) {
        result = await executeEmailDraft({
          to: payload.to,
          subject: payload.subject ?? "Room scene",
          bodyText: payload.note ?? payload.bodyText ?? "Scene attached.",
          attachmentAssetIds: payload.attachmentAssetIds ?? [],
        });
      } else {
        result = { provider: "none", ref: approval.id, description: "scene released" };
      }
      break;
    }
  }

  await audit({
    actor: "system",
    action: "effect.executed",
    objectType: "approval",
    objectId: approval.id,
    detail: { kind: approval.kind, provider: result.provider, ref: result.ref, agent: agentName ?? "unknown" },
  });
  return result;
}

async function executeEmailDraft(payload: Record<string, unknown>): Promise<ExecutionResult> {
  const email = getEmailProvider();
  const { draftId, threadId } = await email.createDraft({
    to: (payload.to ?? []) as string[],
    cc: (payload.cc ?? []) as string[],
    subject: String(payload.subject ?? "(no subject)"),
    bodyText: String(payload.bodyText ?? payload.body_markdown ?? ""),
    attachmentAssetIds: (payload.attachmentAssetIds ?? payload.attachment_pds_ids ?? []) as string[],
    inReplyToEmailId: typeof payload.inReplyToEmailId === "string" ? payload.inReplyToEmailId : undefined,
    threadId: typeof payload.threadId === "string" ? payload.threadId : undefined,
  });
  const { sentEmailId } = await email.send(draftId);
  // Quote replies carry linkage: releasing the email marks the quote sent.
  if (typeof payload.quoteId === "string") {
    await db.update(quotes).set({ status: "sent" }).where(eq(quotes.id, payload.quoteId));
  }
  return { provider: "email", ref: sentEmailId, description: `sent to ${(payload.to as string[]).join(", ")} · thread ${threadId}` };
}

async function executeOpportunityUpdate(payload: Record<string, unknown>, demoNow: Date): Promise<ExecutionResult> {
  const accountId = String(payload.accountId ?? "");
  const fieldDiffs = (payload.fieldDiffs ?? []) as { field: string; old: unknown; new: unknown }[];
  const newOpp = payload.newOpportunity as
    | { name: string; stage?: string; valueCents?: number; projectHint?: string }
    | undefined;

  let ref = "";
  if (newOpp) {
    const [row] = await db
      .insert(opportunities)
      .values({
        accountId,
        name: newOpp.name,
        stage: (newOpp.stage ?? "lead") as (typeof opportunities.$inferInsert)["stage"],
        valueCents: newOpp.valueCents ?? 0,
        probability: 20,
        nextStep: "Qualify the new opportunity",
        lastActivityAt: demoNow,
      })
      .returning({ id: opportunities.id });
    ref = row!.id;
  }

  const oppId = typeof payload.opportunityId === "string" ? payload.opportunityId : null;
  if (oppId) {
    const patch: Record<string, unknown> = { lastActivityAt: demoNow };
    for (const d of fieldDiffs) {
      if (d.field === "__create__") continue;
      if (d.field === "stage") patch.stage = d.new;
      if (d.field === "value_cents" || d.field === "valueCents") patch.valueCents = Number(d.new);
      if (d.field === "probability") patch.probability = Number(d.new);
      if (d.field === "next_step" || d.field === "nextStep") patch.nextStep = String(d.new);
      if (d.field === "expected_close" || d.field === "expectedClose") patch.expectedClose = String(d.new);
    }
    await db.update(opportunities).set(patch).where(eq(opportunities.id, oppId));
    ref = oppId;
  }

  await db.insert(activities).values({
    type: "note",
    accountId: accountId || null,
    opportunityId: oppId ?? (ref || null),
    refType: "approval",
    summary: newOpp ? `New opportunity created: ${newOpp.name}` : "Opportunity updated from approved agent proposal",
    detail: { diffs: fieldDiffs },
    occurredAt: demoNow,
  });

  return { provider: "crm", ref: ref || accountId, description: "opportunity updated" };
}
