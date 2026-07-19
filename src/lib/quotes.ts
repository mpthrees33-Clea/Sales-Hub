/**
 * Quote persistence + routing consumption (WO-05 tasks 4–5, 7). runQuoteFromRouting
 * is the entry point for both WO-08's nightly fan-out and the email UI's "Draft
 * quote" button: claim the routing atomically, run the quote agent, persist the
 * quotes row, link it to the email_draft approval, and mark the routing consumed.
 * Idempotent — a consumed routing can't be re-claimed, so re-runs create nothing.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, approvals, emails, quotes, type Evidence, type QuoteLine } from "@/db/schema";
import { getErpProvider } from "@/providers";
import { getDemoNow } from "@/lib/demo-clock";
import { claimRoutingById, completeRouting, releaseRouting } from "@/lib/routing";
import { quoteAgent, type QuoteOutput } from "@/agents/quote";

export type QuoteRunResult =
  | { status: "skipped" }
  | { status: "escalated"; runId: string }
  | { status: "failed"; runId: string }
  | { status: "drafted"; runId: string; quoteId: string; quoteNumber: string; approvalId: string | null; totalCents: number };

export async function runQuoteFromRouting(
  routingId: string,
  opts: { trigger: "user" | "nightly" | "workflow" } = { trigger: "user" },
): Promise<QuoteRunResult> {
  const claimed = await claimRoutingById(routingId);
  if (!claimed) return { status: "skipped" };

  try {
    const result = await quoteAgent.run({ routingId }, { trigger: opts.trigger });
    if (result.status !== "succeeded" || !result.output) {
      // Escalated run is the human-facing record; the routing is done either way.
      await completeRouting(routingId, result.runId);
      return { status: result.status === "escalated" ? "escalated" : "failed", runId: result.runId };
    }

    const out = result.output as QuoteOutput;
    const demoNow = await getDemoNow();
    const number = await getErpProvider().nextNumber("Q");
    const validUntil = new Date(demoNow.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

    const lines: QuoteLine[] = out.pricedLines.map((l) => ({
      productId: l.productId,
      sku: l.sku,
      description: l.description,
      qty: l.qty,
      uom: l.uom,
      unitPriceCents: l.unitPriceCents,
      extendedCents: l.extendedCents,
      leadTimeDays: l.leadTimeDays,
      sourceRowId: l.sourceRowId,
      splitProposed: l.splitProposed,
      availableNow: l.availableNow,
    }));

    const [quote] = await db
      .insert(quotes)
      .values({
        accountId: out.accountId,
        number,
        status: "pending_approval",
        lines,
        subtotalCents: out.subtotalCents,
        totalCents: out.totalCents,
        validUntil,
        sourceEmailId: claimed.emailId,
        latencyMs: out.latencyMs,
      })
      .returning({ id: quotes.id });

    // Link the email_draft approval back to the persisted quote, and prepend the
    // source-email evidence (the quote tools already contributed inventory_row +
    // price_row evidence).
    if (out.approvalId) {
      const appr = await db.query.approvals.findFirst({ where: eq(approvals.id, out.approvalId) });
      if (appr) {
        const srcEmail = await db.query.emails.findFirst({ where: eq(emails.id, claimed.emailId) });
        const emailEvidence: Evidence = { type: "email", ref: { emailId: claimed.emailId }, quote: srcEmail?.subject ?? "quote request" };
        const hasEmail = appr.evidence.some((e) => e.type === "email");
        await db
          .update(approvals)
          .set({
            proposedAction: { ...appr.proposedAction, quoteId: quote!.id, quoteNumber: number },
            evidence: hasEmail ? appr.evidence : [emailEvidence, ...appr.evidence],
          })
          .where(eq(approvals.id, out.approvalId));
      }
    }

    await completeRouting(routingId, result.runId);
    await db.insert(activities).values({
      type: "quote",
      accountId: out.accountId,
      refType: "quote",
      refId: quote!.id,
      summary: `Quote ${number} drafted (${(out.totalCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })})`,
      detail: { number, totalCents: out.totalCents, splitProposed: out.splitProposed },
      occurredAt: demoNow,
    });

    return { status: "drafted", runId: result.runId, quoteId: quote!.id, quoteNumber: number, approvalId: out.approvalId, totalCents: out.totalCents };
  } catch (err) {
    // Transient failure — release the routing so it can be retried.
    await releaseRouting(routingId);
    throw err;
  }
}
