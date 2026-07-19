/** PO Intake reads (WO-06 UI). Server-only. */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, approvals, purchaseOrders, type ValidationLayerResult } from "@/db/schema";
import type { PoExtraction } from "@/agents/po-intake";

export type PoListRow = {
  id: string;
  customerPoNumber: string | null;
  accountName: string | null;
  totalCents: number | null;
  status: string;
  layerSummary: string;
  elapsedMs: number | null;
};

export async function listPurchaseOrders(): Promise<PoListRow[]> {
  const rows = await db
    .select({
      id: purchaseOrders.id,
      customerPoNumber: purchaseOrders.customerPoNumber,
      status: purchaseOrders.status,
      validation: purchaseOrders.validation,
      extracted: purchaseOrders.extracted,
      elapsedMs: purchaseOrders.elapsedMs,
      accountName: accounts.name,
    })
    .from(purchaseOrders)
    .leftJoin(accounts, eq(accounts.id, purchaseOrders.accountId))
    .orderBy(desc(purchaseOrders.createdAt));

  return rows.map((r) => {
    const validation = (r.validation ?? []) as ValidationLayerResult[];
    const passed = validation.filter((v) => v.pass).length;
    const failed = validation.find((v) => !v.pass);
    const summary = validation.length === 0 ? "—" : passed === 7 ? "7/7" : `failed L${failed?.layer ?? "?"}`;
    const totals = (r.extracted as { totals?: { total_cents?: number } } | null)?.totals;
    return {
      id: r.id,
      customerPoNumber: r.customerPoNumber,
      accountName: r.accountName,
      totalCents: totals?.total_cents ?? null,
      status: r.status,
      layerSummary: summary,
      elapsedMs: r.elapsedMs,
    };
  });
}

export type PoDetail = {
  id: string;
  status: string;
  blobUrl: string;
  elapsedMs: number | null;
  extraction: PoExtraction | null;
  validation: ValidationLayerResult[];
  approvalId: string | null;
  accountName: string | null;
};

export async function getPurchaseOrder(id: string): Promise<PoDetail | null> {
  const [row] = await db
    .select({
      id: purchaseOrders.id,
      status: purchaseOrders.status,
      blobUrl: purchaseOrders.blobUrl,
      elapsedMs: purchaseOrders.elapsedMs,
      extracted: purchaseOrders.extracted,
      validation: purchaseOrders.validation,
      accountName: accounts.name,
    })
    .from(purchaseOrders)
    .leftJoin(accounts, eq(accounts.id, purchaseOrders.accountId))
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (!row) return null;

  // Find the approval that references this PO.
  const apprRows = await db.select({ id: approvals.id, proposed: approvals.proposedAction }).from(approvals).where(eq(approvals.kind, "sales_order"));
  const approvalId = apprRows.find((a) => (a.proposed as { poId?: string }).poId === id)?.id ?? null;

  const extracted = row.extracted as (PoExtraction & { fingerprint?: string; meta?: unknown }) | null;
  return {
    id: row.id,
    status: row.status,
    blobUrl: row.blobUrl,
    elapsedMs: row.elapsedMs,
    extraction: extracted && "customer_po_number" in extracted ? extracted : null,
    validation: (row.validation ?? []) as ValidationLayerResult[],
    approvalId,
    accountName: row.accountName,
  };
}
