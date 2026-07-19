/**
 * Quote persistence + numbering + latency helpers (WO-05 task 4/5/7), and
 * the routing consumer WO-08's nightly fan-out and the email UI's "Draft
 * quote" button call.
 */
import { db } from "@/db/client";
import { quotes, type QuoteLine } from "@/db/schema";
import { getDemoNow } from "@/lib/demo-clock";
import { claimRoutingById, claimRouting, completeRouting, releaseRouting } from "@/lib/routing";
import { getErpProvider } from "@/providers";
import type { AgentRunResult } from "@/harness/define-agent";

export type QuoteApprovalPayload = {
  to: string[];
  subject: string;
  bodyText: string;
  attachmentAssetIds: string[];
  inReplyToEmailId?: string;
  quoteId: string;
  quoteNumber: string;
  quote: {
    accountName: string;
    lines: QuoteLine[];
    subtotalCents: number;
    totalCents: number;
    validUntil: string;
    latencyMs: number;
    splitProposed: boolean;
  };
};

/** Insert the quotes row (status pending_approval, Q-<seq> continuing the seeded sequence). */
export async function recordQuote(input: {
  accountId: string;
  opportunityId?: string | null;
  lines: QuoteLine[];
  subtotalCents: number;
  sourceEmailId?: string | null;
  latencyMs: number;
}): Promise<{ quoteId: string; number: string; validUntil: string }> {
  const demoNow = await getDemoNow();
  const number = await getErpProvider().nextNumber("Q");
  const validUntil = new Date(demoNow.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const [row] = await db
    .insert(quotes)
    .values({
      accountId: input.accountId,
      opportunityId: input.opportunityId ?? null,
      number,
      status: "pending_approval",
      lines: input.lines,
      subtotalCents: input.subtotalCents,
      totalCents: input.subtotalCents,
      validUntil,
      sourceEmailId: input.sourceEmailId ?? null,
      latencyMs: input.latencyMs,
    })
    .returning({ id: quotes.id });
  return { quoteId: row!.id, number, validUntil };
}

/**
 * Claim → run the quote agent → complete (idempotent via claim; escalated
 * runs also complete — the escalated run is the human-facing record).
 */
export async function runQuoteFromRouting(
  routingId: string,
  opts: { trigger: "nightly" | "user" | "workflow"; workflowRunId?: string },
): Promise<AgentRunResult<unknown> | null> {
  const claimed = await claimRoutingById(routingId, null);
  if (!claimed) return null;
  return runClaimedQuote(claimed.id, opts);
}

/** Nightly fan-out variant: claim the oldest pending quote routing. */
export async function runNextQuoteRouting(
  opts: { trigger: "nightly" | "workflow"; workflowRunId?: string },
): Promise<AgentRunResult<unknown> | null> {
  const claimed = await claimRouting("quote", null);
  if (!claimed) return null;
  return runClaimedQuote(claimed.id, opts);
}

async function runClaimedQuote(
  routingId: string,
  opts: { trigger: "nightly" | "user" | "workflow"; workflowRunId?: string },
): Promise<AgentRunResult<unknown>> {
  const { quoteAgent } = await import("@/agents/quote");
  try {
    const result = await quoteAgent.run({ routingId }, opts);
    await completeRouting(routingId, result.runId);
    return result;
  } catch (err) {
    await releaseRouting(routingId);
    throw err;
  }
}
