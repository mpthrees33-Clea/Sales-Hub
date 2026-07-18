/**
 * Approval-inbox reads (WO-03). Server-only. Sweeps expired approvals on load,
 * groups the actionable queue by risk tier then kind, derives each acting
 * agent's scoped-tool list from its recorded steps (for <AgentBadge/>), and
 * resolves every evidence item into a renderable source ("Every answer shows
 * its source").
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  agentSteps,
  approvals,
  emails,
  inventory,
  pdsDocuments,
  priceListItems,
  priceLists,
  products,
  transcripts,
  type Evidence,
} from "@/db/schema";
import { getDemoNow } from "@/lib/demo-clock";
import { sweepExpired } from "@/lib/approvals/expiry";

export type AgentTool = { name: string; effect: "read" | "internal_write" | "external" };

/** Heuristic effect tag from a recorded tool-call name (agents land in WO-04+). */
function effectOf(toolName: string): AgentTool["effect"] {
  if (/^(get|check|lookup|list|resolve|read|fetch|search)_/.test(toolName)) return "read";
  if (/(create|send|propose|draft|order|submit|generate)/.test(toolName)) return "external";
  return "internal_write";
}

async function deriveAgentTools(runId: string | null): Promise<AgentTool[]> {
  if (!runId) return [];
  const rows = await db
    .select({ name: agentSteps.name, kind: agentSteps.kind })
    .from(agentSteps)
    .where(and(eq(agentSteps.runId, runId), eq(agentSteps.kind, "tool_call")))
    .orderBy(asc(agentSteps.seq));
  const seen = new Set<string>();
  const out: AgentTool[] = [];
  for (const r of rows) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    out.push({ name: r.name, effect: effectOf(r.name) });
  }
  return out;
}

export type EvidenceSource =
  | { kind: "email"; subject: string; from: string; receivedAt: string; bodyText: string }
  | { kind: "pdf"; blobUrl: string; page: number; bbox?: [number, number, number, number] }
  | { kind: "price_row"; sku: string; tier: string; priceListName: string; unitPriceCents: number; minQty: number }
  | { kind: "transcript"; speaker: string; t0: number; t1: number; text: string }
  | { kind: "inventory"; sku: string; onHand: number; allocated: number; leadTimeDays: number }
  | { kind: "unknown" };

export type ResolvedEvidence = { type: Evidence["type"]; quote: string; refId: string; source: EvidenceSource };

function refIdOf(ref: Record<string, unknown>): string {
  const v = ref.emailId ?? ref.priceListItemId ?? ref.pdsDocumentId ?? ref.blobKey ?? ref.meetingId ?? ref.sku ?? "";
  return String(v);
}

async function resolveOne(e: Evidence): Promise<EvidenceSource> {
  const ref = e.ref as Record<string, unknown>;
  switch (e.type) {
    case "email": {
      const row = await db.query.emails.findFirst({ where: eq(emails.id, String(ref.emailId)) });
      if (!row) return { kind: "unknown" };
      return { kind: "email", subject: row.subject, from: row.fromEmail, receivedAt: row.receivedAt.toISOString(), bodyText: row.bodyText };
    }
    case "pdf_page": {
      let blobUrl = typeof ref.blobKey === "string" ? `/api/blob/${ref.blobKey}` : "";
      if (!blobUrl && typeof ref.pdsDocumentId === "string") {
        const doc = await db.query.pdsDocuments.findFirst({ where: eq(pdsDocuments.id, ref.pdsDocumentId) });
        blobUrl = doc?.blobUrl ?? "";
      }
      const bbox = Array.isArray(ref.bbox) && ref.bbox.length === 4 ? (ref.bbox as [number, number, number, number]) : undefined;
      return { kind: "pdf", blobUrl, page: typeof ref.page === "number" ? ref.page : 1, bbox };
    }
    case "price_row": {
      const [row] = await db
        .select({
          sku: products.sku,
          unitPriceCents: priceListItems.unitPriceCents,
          minQty: priceListItems.minQty,
          tier: priceLists.tier,
          priceListName: priceLists.name,
        })
        .from(priceListItems)
        .innerJoin(products, eq(products.id, priceListItems.productId))
        .innerJoin(priceLists, eq(priceLists.id, priceListItems.priceListId))
        .where(eq(priceListItems.id, String(ref.priceListItemId)))
        .limit(1);
      if (!row) return { kind: "unknown" };
      return { kind: "price_row", sku: row.sku, tier: row.tier, priceListName: row.priceListName, unitPriceCents: row.unitPriceCents, minQty: row.minQty };
    }
    case "transcript_segment": {
      const t = await db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, String(ref.meetingId)) });
      const seg = t?.segments?.[typeof ref.segment === "number" ? ref.segment : 0];
      if (!seg) return { kind: "unknown" };
      return { kind: "transcript", speaker: seg.speaker, t0: seg.t0, t1: seg.t1, text: seg.text };
    }
    case "inventory_row": {
      const [row] = await db
        .select({ sku: products.sku, onHand: inventory.onHand, allocated: inventory.allocated, leadTimeDays: inventory.leadTimeDays })
        .from(products)
        .innerJoin(inventory, eq(inventory.productId, products.id))
        .where(eq(products.sku, String(ref.sku)))
        .limit(1);
      if (!row) return { kind: "unknown" };
      return { kind: "inventory", sku: row.sku, onHand: row.onHand, allocated: row.allocated, leadTimeDays: row.leadTimeDays };
    }
  }
}

async function resolveEvidence(items: Evidence[]): Promise<ResolvedEvidence[]> {
  return Promise.all(
    items.map(async (e) => ({ type: e.type, quote: e.quote, refId: refIdOf(e.ref as Record<string, unknown>), source: await resolveOne(e) })),
  );
}

export type LoadedApproval = {
  id: string;
  kind: (typeof approvals.$inferSelect)["kind"];
  riskTier: "low" | "standard" | "high";
  status: (typeof approvals.$inferSelect)["status"];
  proposedAction: Record<string, unknown>;
  evidence: ResolvedEvidence[];
  createdDemoAt: string;
  expiresDemoAt: string;
  blockedReason: { rule: string; reason: string } | null;
  runId: string | null;
  agentName: string | null;
  agentTools: AgentTool[];
};

const TIER_ORDER: Record<string, number> = { high: 0, standard: 1, low: 2 };

async function toLoaded(row: typeof approvals.$inferSelect): Promise<LoadedApproval> {
  const [evidence, agentTools, agentRow] = await Promise.all([
    resolveEvidence(row.evidence),
    deriveAgentTools(row.runId),
    row.runId ? db.query.agentRuns.findFirst({ columns: { agentName: true }, where: (r, { eq: e }) => e(r.id, row.runId!) }) : Promise.resolve(null),
  ]);
  return {
    id: row.id,
    kind: row.kind,
    riskTier: row.riskTier,
    status: row.status,
    proposedAction: row.proposedAction,
    evidence,
    createdDemoAt: row.createdDemoAt.toISOString(),
    expiresDemoAt: row.expiresDemoAt.toISOString(),
    blockedReason: row.blockedReason ?? null,
    runId: row.runId,
    agentName: agentRow?.agentName ?? null,
    agentTools,
  };
}

export type QueueData = {
  demoNow: string;
  pending: LoadedApproval[];
  resolved: LoadedApproval[];
  pendingCount: number;
};

/** Load the full inbox: sweep expiries, then pending (tier-ordered) + recently resolved. */
export async function loadQueue(): Promise<QueueData> {
  const demoNow = await getDemoNow();
  await sweepExpired(demoNow);

  const rows = await db.select().from(approvals).orderBy(asc(approvals.createdDemoAt));
  const pendingRows = rows.filter((r) => r.status === "pending");
  const resolvedRows = rows.filter((r) => r.status !== "pending");

  const pending = await Promise.all(pendingRows.map(toLoaded));
  const resolved = await Promise.all(resolvedRows.map(toLoaded));

  pending.sort((a, b) => (TIER_ORDER[a.riskTier]! - TIER_ORDER[b.riskTier]!) || a.kind.localeCompare(b.kind));

  return { demoNow: demoNow.toISOString(), pending, resolved, pendingCount: pending.length };
}

export async function pendingApprovalCount(): Promise<number> {
  const rows = await db.select({ id: approvals.id }).from(approvals).where(eq(approvals.status, "pending"));
  return rows.length;
}

// Kept for potential targeted refetch by id.
export async function loadApproval(id: string): Promise<LoadedApproval | null> {
  const row = await db.query.approvals.findFirst({ where: eq(approvals.id, id) });
  return row ? toLoaded(row) : null;
}
