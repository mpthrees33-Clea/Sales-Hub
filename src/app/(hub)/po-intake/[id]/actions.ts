"use server";

/**
 * Escalation resolution (WO-06 task 13) — human-only, audit-logged. The rep can
 * correct the offending extracted value(s) → the seven layers re-run
 * deterministically → 7/7 finalizes into a draft SO; or reject. No agent
 * involvement in resolution.
 */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentSteps, approvals, purchaseOrders, salesOrders, type SalesOrderLine, type ValidationLayerResult } from "@/db/schema";
import { poExtraction, type PoExtraction } from "@/agents/po-intake";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { getDemoNow } from "@/lib/demo-clock";
import { getErpProvider } from "@/providers";
import { REP } from "@/lib/rep";
import { runAllLayers, resolveAccount } from "@/lib/po-intake/layers";
import { lineFingerprint } from "@/lib/po-intake/match";

/** Correct the layer-3 price mismatches to the price-list value, then re-validate. */
export async function fixPricesAndRevalidate(poId: string): Promise<{ status: string; passed: number }> {
  const { userId } = await requireSession();
  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) });
  if (!po) return { status: "not_found", passed: 0 };
  const extraction = poExtraction.parse(po.extracted);

  // Pull expected prices from the recorded layer-3 detail and apply them.
  const l3 = (po.validation ?? []).find((v) => v.layer === 3);
  const mismatches = (l3?.detail as { mismatches?: { sku: string; expected_cents: number }[] } | undefined)?.mismatches ?? [];
  const edits: { path: string; old: unknown; new: unknown }[] = [];
  for (const m of mismatches) {
    const line = extraction.lines.find((l) => (l.resolved?.sku ?? l.raw_sku_text) === m.sku);
    if (line && line.unit_price_cents !== m.expected_cents) {
      edits.push({ path: `lines[${extraction.lines.indexOf(line)}].unit_price_cents`, old: line.unit_price_cents, new: m.expected_cents });
      line.unit_price_cents = m.expected_cents;
      line.line_total_cents = line.qty * m.expected_cents;
    }
  }
  // Recompute totals from the corrected lines.
  extraction.totals.subtotal_cents = extraction.lines.reduce((a, l) => a + l.qty * l.unit_price_cents, 0);
  extraction.totals.total_cents = extraction.totals.subtotal_cents + (extraction.totals.tax_cents ?? 0);

  return finalizeAfterEdit(po.id, extraction, edits, userId);
}

export async function rejectPo(poId: string): Promise<void> {
  const { userId } = await requireSession();
  const appr = await findApproval(poId);
  if (appr) {
    await db.update(approvals).set({ status: "rejected", resolvedAt: await getDemoNow(), approverUserId: REP.id }).where(eq(approvals.id, appr.id));
  }
  await audit({ actor: `user:${userId}`, action: "po.rejected", objectType: "purchase_order", objectId: poId });
  revalidatePath(`/po-intake/${poId}`);
  revalidatePath("/po-intake");
}

async function findApproval(poId: string): Promise<{ id: string; runId: string | null } | null> {
  const rows = await db.select({ id: approvals.id, runId: approvals.runId, proposed: approvals.proposedAction }).from(approvals).where(eq(approvals.kind, "sales_order"));
  const hit = rows.find((r) => (r.proposed as { poId?: string }).poId === poId);
  return hit ? { id: hit.id, runId: hit.runId } : null;
}

async function finalizeAfterEdit(poId: string, extraction: PoExtraction, edits: { path: string; old: unknown; new: unknown }[], userId: string): Promise<{ status: string; passed: number }> {
  const demoNow = await getDemoNow();
  const pageCount = Math.max(1, ...extraction.lines.map((l) => l.page), extraction.totals.page);
  const verdicts = await runAllLayers({ extraction, poId, demoNow, pageCount });
  const validation: ValidationLayerResult[] = verdicts.map((v) => ({ layer: v.layer, name: v.name, pass: v.pass, detail: v.detail, durationMs: 4 + v.layer * 3 }));
  const passed = verdicts.filter((v) => v.pass).length;

  const appr = await findApproval(poId);
  if (appr?.runId) {
    const baseSeq = (await db.select({ seq: agentSteps.seq }).from(agentSteps).where(eq(agentSteps.runId, appr.runId))).length;
    let seq = baseSeq;
    for (const v of validation) {
      await db.insert(agentSteps).values({ runId: appr.runId, seq: ++seq, kind: "validation", name: `${v.name} (re-run)`, input: null, output: { pass: v.pass, detail: v.detail }, durationMs: v.durationMs });
    }
  }

  const fingerprint = extraction.lines.every((l) => l.resolved) ? lineFingerprint(extraction.lines.map((l) => ({ productId: l.resolved!.product_id, qty: l.qty, unitPriceCents: l.unit_price_cents }))) : undefined;
  await db.update(purchaseOrders).set({ extracted: { ...(extraction as unknown as Record<string, unknown>), fingerprint }, validation }).where(eq(purchaseOrders.id, poId));

  if (passed === 7) {
    const account = await resolveAccount(extraction);
    const soLines: SalesOrderLine[] = extraction.lines.map((l) => ({ productId: l.resolved!.product_id, sku: l.resolved!.sku, description: l.description, qty: l.qty, uom: l.uom, unitPriceCents: l.unit_price_cents, extendedCents: l.qty * l.unit_price_cents }));
    const number = await getErpProvider().nextNumber("SO");
    const [so] = await db.insert(salesOrders).values({ poId, accountId: account!.accountId, number, lines: soLines, subtotalCents: extraction.totals.subtotal_cents, totalCents: extraction.totals.total_cents, status: "draft" }).returning({ id: salesOrders.id });
    await db.update(purchaseOrders).set({ status: "converted", accountId: account!.accountId }).where(eq(purchaseOrders.id, poId));
    if (appr) {
      const row = await db.query.approvals.findFirst({ where: eq(approvals.id, appr.id) });
      await db.update(approvals).set({
        proposedAction: { poId, soId: so!.id, soNumber: number, accountId: account!.accountId, accountName: account!.name, customerPoNumber: extraction.customer_po_number.value, lines: soLines, subtotalCents: extraction.totals.subtotal_cents, totalCents: extraction.totals.total_cents, validation, resolvedFromEscalation: true },
        edits: [...(row?.edits ?? []), ...edits],
      }).where(eq(approvals.id, appr.id));
    }
    await audit({ actor: `user:${userId}`, action: "po.resolved", objectType: "purchase_order", objectId: poId, detail: { soNumber: number, edits: edits.length } });
  } else {
    await audit({ actor: `user:${userId}`, action: "po.revalidated", objectType: "purchase_order", objectId: poId, detail: { passed, edits: edits.length } });
  }

  revalidatePath(`/po-intake/${poId}`);
  revalidatePath("/po-intake");
  revalidatePath("/approvals");
  return { status: passed === 7 ? "converted" : "escalated", passed };
}
