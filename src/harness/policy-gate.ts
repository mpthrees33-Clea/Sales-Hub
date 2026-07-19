/**
 * The deterministic policy gate (docs/02-SECURITY-FRAMEWORK.md §2.3).
 * Prompt-free, code-only. Runs at approval-EXECUTION time (WO-03's resolution
 * server action), never at draft time — model output can never bypass it.
 *
 * Rule families:
 *   (a) recipient allowlist — every to/cc/bcc must be a seeded contact email
 *       or on a domain derived from seeded contacts
 *   (b) rate caps — ≤ sendsPerHour external effects per trailing demo-clock
 *       hour, ≤ perAgentSendsPerHour per agent (counted via audit_log)
 *   (c) attachment origin — attachment refs must be library assets,
 *       pds_documents, or blob outputs of a recorded run
 *   (d) risk tiers — `high` can never be batch-approved; batch is low-only
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agentRuns, approvals, auditLog, contacts } from "@/db/schema";
import type { ApprovalKind } from "./tool";

export const POLICY_CONFIG = {
  /** Max external effects executed per trailing demo-clock hour, all agents. */
  sendsPerHour: 50,
  /** Max external effects per trailing demo-clock hour attributed to one agent. */
  perAgentSendsPerHour: 20,
  /** Quotes at or above this commit pricing → high tier (never batch-approved). */
  highQuoteThresholdCents: 1_000_000, // $10,000
  /** Approvals expire this many demo-clock hours after creation. */
  approvalExpiryHours: 72,
  /** Only these tiers may be batch-approved. */
  batchApprovableTiers: ["low"] as const,
} as const;

export type RiskTier = "low" | "standard" | "high";

/**
 * Deterministic risk tiering per kind + payload (docs/02 §2.3d). Sales orders
 * and price-committing quotes are high; sample confirmations and scheduling
 * replies are low; everything else standard.
 */
export function assignRiskTier(kind: ApprovalKind, payload: Record<string, unknown>): RiskTier {
  switch (kind) {
    case "sales_order":
      return "high";
    case "quote":
      return quoteTotalCents(payload) >= POLICY_CONFIG.highQuoteThresholdCents ? "high" : "standard";
    case "sample_order":
      return "low";
    case "email_draft": {
      const intent = typeof payload.intent === "string" ? payload.intent : undefined;
      if (intent === "scheduling" || intent === "sample_confirmation") return "low";
      const embedded = quoteTotalCents(payload);
      if (embedded >= POLICY_CONFIG.highQuoteThresholdCents) return "high";
      return "standard";
    }
    case "opportunity_update":
    case "submittal":
    case "scene_send":
      return "standard";
  }
}

function quoteTotalCents(payload: Record<string, unknown>): number {
  const direct = payload.totalCents;
  if (typeof direct === "number") return direct;
  const quote = payload.quote as Record<string, unknown> | undefined;
  if (quote && typeof quote.totalCents === "number") return quote.totalCents;
  return 0;
}

export type GateContext = {
  demoNow: Date;
  /** True when this resolution is part of a batch approve. */
  batch?: boolean;
};

export type GateVerdict = { allowed: true } | { allowed: false; rule: string; reason: string };

type ApprovalRow = typeof approvals.$inferSelect;

/**
 * The gate. Called by the approval-resolution server action against the
 * resolved (possibly human-edited) payload, immediately before execution.
 */
export async function runPolicyGate(approval: ApprovalRow, ctx: GateContext): Promise<GateVerdict> {
  // (d) tier rules first — cheap and absolute.
  if (ctx.batch && !(POLICY_CONFIG.batchApprovableTiers as readonly string[]).includes(approval.riskTier)) {
    return {
      allowed: false,
      rule: "risk_tier_batch",
      reason: `${approval.riskTier}-tier approvals can never be batch-approved`,
    };
  }

  // (a) recipient allowlist for kinds that address the outside world.
  const recipients = extractRecipients(approval.kind, approval.proposedAction);
  if (recipients.length > 0) {
    const allow = await getRecipientAllowlist();
    for (const r of recipients) {
      const email = r.trim().toLowerCase();
      const domain = email.split("@")[1] ?? "";
      if (!allow.emails.has(email) && !allow.domains.has(domain)) {
        return {
          allowed: false,
          rule: "recipient_allowlist",
          reason: `Recipient ${email} is not an allowlisted contact`,
        };
      }
    }
  }

  // (c) attachment origin.
  const attachmentIds = extractAttachmentIds(approval.proposedAction);
  if (attachmentIds.length > 0) {
    const verdict = await checkAttachmentOrigin(attachmentIds);
    if (!verdict.allowed) return verdict;
  }

  // (b) rate caps, counted over executed effects in the trailing demo-clock hour.
  const hourAgo = new Date(ctx.demoNow.getTime() - 3600_000);
  const [{ count: total }] = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(and(eq(auditLog.action, "effect.executed"), gte(auditLog.demoAt, hourAgo)))) as [{ count: number }];
  if (total >= POLICY_CONFIG.sendsPerHour) {
    return {
      allowed: false,
      rule: "rate_cap_global",
      reason: `Global cap reached: ${total} external effects in the trailing demo-clock hour (max ${POLICY_CONFIG.sendsPerHour})`,
    };
  }

  const agentName = await agentNameForRun(approval.runId);
  if (agentName) {
    const [{ count: perAgent }] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "effect.executed"),
          gte(auditLog.demoAt, hourAgo),
          sql`${auditLog.detail} ->> 'agent' = ${agentName}`,
        ),
      )) as [{ count: number }];
    if (perAgent >= POLICY_CONFIG.perAgentSendsPerHour) {
      return {
        allowed: false,
        rule: "rate_cap_agent",
        reason: `Per-agent cap reached for ${agentName}: ${perAgent} effects in the trailing hour (max ${POLICY_CONFIG.perAgentSendsPerHour})`,
      };
    }
  }

  return { allowed: true };
}

/** to/cc/bcc extraction per approval kind (email-bearing kinds only). */
export function extractRecipients(kind: ApprovalKind, payload: Record<string, unknown>): string[] {
  if (kind !== "email_draft" && kind !== "scene_send") return [];
  const out: string[] = [];
  for (const field of ["to", "cc", "bcc"]) {
    const v = payload[field];
    if (Array.isArray(v)) out.push(...v.filter((x): x is string => typeof x === "string"));
    else if (typeof v === "string") out.push(v);
  }
  return out;
}

export function extractAttachmentIds(payload: Record<string, unknown>): string[] {
  const v = payload.attachmentAssetIds ?? payload.attachment_pds_ids ?? payload.attachmentIds;
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

async function checkAttachmentOrigin(ids: string[]): Promise<GateVerdict> {
  // Single source of attachability: the WO-10 asset-library contract.
  const { isAttachable } = await import("@/lib/assets");
  if (!(await isAttachable(ids))) {
    return {
      allowed: false,
      rule: "attachment_origin",
      reason: `Attachment ${ids.join(", ")} is not a library asset or product document`,
    };
  }
  return { allowed: true };
}

async function agentNameForRun(runId: string | null): Promise<string | null> {
  if (!runId) return null;
  const row = await db.query.agentRuns.findFirst({
    columns: { agentName: true },
    where: eq(agentRuns.id, runId),
  });
  return row?.agentName ?? null;
}

// Allowlist derived from seeded contacts, cached briefly (seed changes are rare).
let allowlistCache: { at: number; emails: Set<string>; domains: Set<string> } | null = null;

export async function getRecipientAllowlist(): Promise<{ emails: Set<string>; domains: Set<string> }> {
  if (allowlistCache && Date.now() - allowlistCache.at < 5_000) return allowlistCache;
  const rows = await db.select({ email: contacts.email }).from(contacts);
  const emails = new Set(rows.map((r) => r.email.toLowerCase()));
  const domains = new Set(
    [...emails].map((e) => e.split("@")[1] ?? "").filter((d) => d.length > 0),
  );
  allowlistCache = { at: Date.now(), emails, domains };
  return allowlistCache;
}

export function invalidateAllowlistCache(): void {
  allowlistCache = null;
}
