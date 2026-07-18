/**
 * Approval-queue query module (WO-03). Draft-ahead: the queue loads with
 * every card's data AND every evidence item's source content resolved
 * server-side, so selection changes render instantly and evidence panels
 * never wait.
 */
import { asc, desc, eq, inArray } from "drizzle-orm";
import { agents } from "@/agents";
import { db } from "@/db/client";
import {
  agentRuns,
  agentSteps,
  approvals,
  emails,
  inventory,
  priceListItems,
  priceLists,
  products,
  transcripts,
  type Evidence,
} from "@/db/schema";
import { getDemoNow } from "@/lib/demo-clock";
import { sweepExpiredApprovals } from "@/lib/approvals/expiry";

export type ResolvedEvidence = Evidence & {
  resolved?:
    | { kind: "email"; subject: string; from: string; receivedAt: string; bodyText: string }
    | { kind: "pdf_page"; blobUrl: string; page: number; bbox?: [number, number, number, number] }
    | { kind: "price_row"; sku: string; priceListName: string; tier: string; unitPriceCents: number; minQty: number }
    | { kind: "transcript_segment"; meetingId: string; segmentIndex: number; speaker: string; text: string; t0: number }
    | { kind: "inventory_row"; sku: string; onHand: number; allocated: number; available: number; leadTimeDays: number };
};

export type QueueApproval = {
  id: string;
  kind: (typeof approvals.$inferSelect)["kind"];
  riskTier: "low" | "standard" | "high";
  status: (typeof approvals.$inferSelect)["status"];
  proposedAction: Record<string, unknown>;
  evidence: ResolvedEvidence[];
  blockedReason: { rule: string; reason: string } | null;
  createdDemoAt: string;
  expiresDemoAt: string;
  runId: string | null;
  agentName: string;
  agentTools: { name: string; effect: "read" | "internal_write" | "external" }[];
};

const TIER_ORDER = { high: 0, standard: 1, low: 2 } as const;
const KIND_ORDER = ["sales_order", "quote", "email_draft", "opportunity_update", "submittal", "sample_order", "scene_send"];

export async function pendingQueue(): Promise<{ queue: QueueApproval[]; demoNow: string }> {
  await sweepExpiredApprovals();
  const demoNow = await getDemoNow();

  const rows = await db
    .select({
      approval: approvals,
      agentName: agentRuns.agentName,
    })
    .from(approvals)
    .leftJoin(agentRuns, eq(agentRuns.id, approvals.runId))
    .where(eq(approvals.status, "pending"))
    .orderBy(desc(approvals.createdDemoAt));

  const queue: QueueApproval[] = [];
  for (const { approval, agentName } of rows) {
    queue.push({
      id: approval.id,
      kind: approval.kind,
      riskTier: approval.riskTier,
      status: approval.status,
      proposedAction: approval.proposedAction,
      evidence: await resolveEvidence(approval.evidence),
      blockedReason: approval.blockedReason ?? null,
      createdDemoAt: approval.createdDemoAt.toISOString(),
      expiresDemoAt: approval.expiresDemoAt.toISOString(),
      runId: approval.runId,
      agentName: agentName ?? "unknown",
      agentTools: await toolsForAgent(agentName ?? "", approval.runId),
    });
  }

  queue.sort((a, b) => {
    const t = TIER_ORDER[a.riskTier] - TIER_ORDER[b.riskTier];
    if (t !== 0) return t;
    const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (k !== 0) return k;
    return a.createdDemoAt.localeCompare(b.createdDemoAt);
  });

  return { queue, demoNow: demoNow.toISOString() };
}

/** Scoped-tool list for the badge: registry first, recorded steps as fallback. */
async function toolsForAgent(
  agentName: string,
  runId: string | null,
): Promise<{ name: string; effect: "read" | "internal_write" | "external" }[]> {
  const def = agents[agentName];
  if (def) return def.tools.map((t) => ({ name: t.name, effect: t.effect }));
  if (!runId) return [];
  const steps = await db
    .select({ name: agentSteps.name })
    .from(agentSteps)
    .where(eq(agentSteps.runId, runId))
    .orderBy(asc(agentSteps.seq));
  const seen = new Set<string>();
  const out: { name: string; effect: "read" | "internal_write" | "external" }[] = [];
  for (const s of steps) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    out.push({
      name: s.name,
      effect: /draft|propose|send|create_email|order/.test(s.name) ? "external" : "read",
    });
  }
  return out;
}

async function resolveEvidence(items: Evidence[]): Promise<ResolvedEvidence[]> {
  const out: ResolvedEvidence[] = [];
  for (const e of items) {
    out.push({ ...e, resolved: await resolveOne(e) });
  }
  return out;
}

async function resolveOne(e: Evidence): Promise<ResolvedEvidence["resolved"]> {
  try {
    switch (e.type) {
      case "email": {
        const id = str(e.ref.emailId);
        if (!id) return undefined;
        const row = await db.query.emails.findFirst({ where: eq(emails.id, id) });
        if (!row) return undefined;
        return {
          kind: "email",
          subject: row.subject,
          from: row.fromEmail,
          receivedAt: row.receivedAt.toISOString(),
          bodyText: row.bodyText,
        };
      }
      case "pdf_page": {
        const blobKey = str(e.ref.blobKey);
        const blobUrl = str(e.ref.blobUrl) ?? (blobKey ? `/api/blob/${blobKey}` : undefined);
        if (!blobUrl) {
          // pds document ref
          const pdsId = str(e.ref.pdsDocumentId);
          if (pdsId) {
            const doc = await db.query.pdsDocuments.findFirst({
              where: (t, { eq: eq2 }) => eq2(t.id, pdsId),
            });
            if (doc) return { kind: "pdf_page", blobUrl: doc.blobUrl, page: 1 };
          }
          return undefined;
        }
        return {
          kind: "pdf_page",
          blobUrl,
          page: Number(e.ref.page ?? 1),
          bbox: Array.isArray(e.ref.bbox) ? (e.ref.bbox as [number, number, number, number]) : undefined,
        };
      }
      case "price_row": {
        const id = str(e.ref.priceListItemId);
        if (!id) return undefined;
        const [row] = await db
          .select({
            sku: products.sku,
            unitPriceCents: priceListItems.unitPriceCents,
            minQty: priceListItems.minQty,
            listName: priceLists.name,
            tier: priceLists.tier,
          })
          .from(priceListItems)
          .innerJoin(products, eq(products.id, priceListItems.productId))
          .innerJoin(priceLists, eq(priceLists.id, priceListItems.priceListId))
          .where(eq(priceListItems.id, id));
        if (!row) return undefined;
        return {
          kind: "price_row",
          sku: row.sku,
          priceListName: row.listName,
          tier: row.tier,
          unitPriceCents: row.unitPriceCents,
          minQty: row.minQty,
        };
      }
      case "transcript_segment": {
        const meetingId = str(e.ref.meetingId);
        const idx = Number(e.ref.segment ?? e.ref.segmentIndex ?? -1);
        if (!meetingId || idx < 0) return undefined;
        const t = await db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, meetingId) });
        const seg = t?.segments?.[idx];
        if (!seg) return undefined;
        return { kind: "transcript_segment", meetingId, segmentIndex: idx, speaker: seg.speaker, text: seg.text, t0: seg.t0 };
      }
      case "inventory_row": {
        const sku = str(e.ref.sku);
        if (!sku) return undefined;
        const [row] = await db
          .select({
            sku: products.sku,
            onHand: inventory.onHand,
            allocated: inventory.allocated,
            leadTimeDays: inventory.leadTimeDays,
          })
          .from(inventory)
          .innerJoin(products, eq(products.id, inventory.productId))
          .where(eq(products.sku, sku));
        if (!row) return undefined;
        return {
          kind: "inventory_row",
          sku: row.sku,
          onHand: row.onHand,
          allocated: row.allocated,
          available: row.onHand - row.allocated,
          leadTimeDays: row.leadTimeDays,
        };
      }
    }
  } catch {
    return undefined;
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function attachableAssetOptions(): Promise<{ id: string; title: string; kind: string }[]> {
  const rows = await db.query.assets.findMany({ orderBy: (t, { asc: a }) => a(t.title) });
  return rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind }));
}

/** Audit trail view data (read-only by construction). */
export async function auditTrail(limit = 200, offset = 0) {
  const { auditLog } = await import("@/db/schema");
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset);
}

export async function resolvedEvidenceForIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(approvals).where(inArray(approvals.id, ids));
}
