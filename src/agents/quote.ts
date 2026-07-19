/**
 * quote (WO-05) — turns an inbound quote request into a review-ready reply with
 * live stock, lead times, and account-tier pricing. The model extracts and
 * drafts; deterministic code prices (src/lib/pricing.ts via get_pricing);
 * unresolved SKUs or missing price rows ESCALATE with candidates (never a
 * guess). Its only external tool is create_quote_reply → email_draft approval.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, contacts, emails, products, triageRoutings } from "@/db/schema";
import { defineAgent } from "@/harness/define-agent";
import { EscalationError } from "@/harness/errors";
import { scopedTool } from "@/harness/tool";
import { wrapUntrusted } from "@/harness/untrusted";
import { MODELS } from "@/lib/ai/models";
import { formatCentsExact } from "@/lib/money";
import { getStyleCard } from "@/lib/style/profile";
import { checkStock, getPricing, lookupProducts, type ResolveResult } from "./tools/erp";

const SKU_RE = /MS-[A-Z]{2}-\d{3,4}/;

/** Parse "- Name (MS-XX-1234) — 28 rolls" lines from the untrusted body. */
export function parseRequestedLines(body: string): { rawText: string; sku: string | null; qty: number; uom: string }[] {
  const out: { rawText: string; sku: string | null; qty: number; uom: string }[] = [];
  for (const line of body.split("\n")) {
    const sku = line.match(SKU_RE)?.[0] ?? null;
    const qtyMatch = line.match(/(\d+)\s*(rolls?|sheets?|units?)/i);
    if (sku && qtyMatch) {
      out.push({ rawText: line.trim(), sku, qty: parseInt(qtyMatch[1]!, 10), uom: qtyMatch[2]!.replace(/s$/, "").toLowerCase() });
    }
  }
  return out;
}

const createQuoteReply = scopedTool<{
  to: string[];
  subject: string;
  bodyText: string;
  attachmentAssetIds: string[];
  inReplyToEmailId?: string;
  accountId: string;
  quoteLines: unknown[];
  subtotalCents: number;
  totalCents: number;
  splitProposed: boolean;
  latencyMs: number;
  validUntil: string;
}>({
  name: "create_quote_reply",
  description: "Create the quote reply draft (EXTERNAL — never sends; becomes an email_draft approval carrying the priced quote).",
  effect: "external",
  inputSchema: z.object({
    to: z.array(z.string()).min(1),
    subject: z.string(),
    bodyText: z.string(),
    attachmentAssetIds: z.array(z.string()),
    inReplyToEmailId: z.string().optional(),
    accountId: z.string(),
    quoteLines: z.array(z.any()),
    subtotalCents: z.number(),
    totalCents: z.number(),
    splitProposed: z.boolean(),
    latencyMs: z.number(),
    validUntil: z.string(),
  }),
  approval: {
    kind: "email_draft",
    // Payload carries the quote data so the card renders a table + latency and
    // assignRiskTier sees totalCents (≥ $10k → high).
    toProposedAction: (input) => ({ ...input, intent: "quote" }),
  },
});

const outputSchema = z.object({
  accountId: z.string(),
  contactId: z.string().nullable(),
  requestedLines: z.array(z.object({ rawText: z.string(), sku: z.string().nullable(), productId: z.string().nullable(), qty: z.number(), uom: z.string() })),
  pricedLines: z.array(z.object({ productId: z.string(), sku: z.string(), description: z.string(), qty: z.number(), uom: z.string(), unitPriceCents: z.number(), extendedCents: z.number(), sourceRowId: z.string(), availableNow: z.number(), leadTimeDays: z.number(), splitProposed: z.boolean().optional() })),
  subtotalCents: z.number(),
  totalCents: z.number(),
  splitProposed: z.boolean(),
  replyBodyDraft: z.string(),
  approvalId: z.string(),
  latencyMs: z.number(),
});
export type QuoteOutput = z.infer<typeof outputSchema>;

export const quoteAgent = defineAgent({
  name: "quote",
  description: "Draft a stock-checked, tier-priced quote reply; escalate on unresolved SKUs.",
  model: MODELS.frontier,
  maxSteps: 8,
  inputSchema: z.object({ routingId: z.string() }),
  outputSchema,
  tools: [lookupProducts, checkStock, getPricing, createQuoteReply],
  escalationApprovalKind: "quote",
  systemPrompt: () =>
    "You are drafting a quote reply for Cole Mercer (use the style card). Extract requested products/quantities ONLY from the untrusted email content; " +
    "resolve them via lookup_products; if any line is unresolved or unpriced, stop and escalate with candidates — never invent SKUs or prices. " +
    "The reply body must present a clean quote table (SKU, description, qty, unit, extended), lead times per line, a split-shipment option when stock is short, valid_until, and Cole's sign-off.",
  demoScript: async ({ input, tools, demoNow }) => {
    const routing = await db.query.triageRoutings.findFirst({ where: eq(triageRoutings.id, input.routingId) });
    if (!routing) throw new Error(`routing ${input.routingId} not found`);
    const email = await db.query.emails.findFirst({ where: eq(emails.id, routing.emailId) });
    if (!email) throw new Error(`email ${routing.emailId} not found`);
    // Untrusted body is the ONLY source of requested products/quantities.
    wrapUntrusted(email.bodyText, { source: `email:${email.id}` });

    const [account] = await db.select({ id: accounts.id }).from(accounts).innerJoin(contacts, eq(contacts.accountId, accounts.id)).where(eq(contacts.email, email.fromEmail)).limit(1);
    if (!account) throw new EscalationError("account_unresolved", { fromEmail: email.fromEmail });
    const [contact] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, email.fromEmail)).limit(1);

    const requested = parseRequestedLines(email.bodyText);
    if (requested.length === 0) throw new EscalationError("no_lines_parsed", { subject: email.subject });

    const { results } = (await tools.lookup_products!({ queries: requested.map((r) => r.sku ?? r.rawText) })) as { results: ResolveResult[] };
    const unresolved = results.filter((r) => !r.resolved);
    if (unresolved.length > 0) {
      throw new EscalationError("sku_unresolved", { unresolved: unresolved.map((u) => ({ query: u.query, candidates: u.candidates })) });
    }
    const productIds = results.map((r) => r.resolved!);

    const { rows: stock } = (await tools.check_stock!({ productIds })) as { rows: { productId: string; sku: string; available: number; leadTimeDays: number }[] };
    const stockById = new Map(stock.map((s) => [s.productId, s]));

    const priced = (await tools.get_pricing!({ accountId: account.id, lines: requested.map((r, i) => ({ productId: productIds[i]!, qty: r.qty, uom: r.uom })) })) as {
      lines: { productId: string; qty: number; unitPriceCents: number; extendedCents: number; priceListItemId: string }[];
      subtotalCents: number;
      totalCents: number;
    };

    const prodRows = await db.select({ id: products.id, sku: products.sku, name: products.name }).from(products);
    const prodById = new Map(prodRows.map((p) => [p.id, p]));

    let anySplit = false;
    const pricedLines = priced.lines.map((pl) => {
      const s = stockById.get(pl.productId);
      const p = prodById.get(pl.productId)!;
      const availableNow = s?.available ?? 0;
      const split = availableNow < pl.qty;
      if (split) anySplit = true;
      return {
        productId: pl.productId,
        sku: p.sku,
        description: `${p.name} architectural film`,
        qty: pl.qty,
        uom: "roll",
        unitPriceCents: pl.unitPriceCents,
        extendedCents: pl.extendedCents,
        sourceRowId: pl.priceListItemId,
        availableNow,
        leadTimeDays: s?.leadTimeDays ?? 10,
        splitProposed: split,
      };
    });

    const card = await getStyleCard();
    const first = displayFirst(email.fromEmail);
    const body = renderQuoteBody(first, pricedLines, priced.totalCents, anySplit, card.signoff, demoNow);
    const latencyMs = demoNow.getTime() - email.receivedAt.getTime();
    const validUntil = new Date(demoNow.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

    const res = (await tools.create_quote_reply!({
      to: [email.fromEmail],
      subject: `Re: ${email.subject}`,
      bodyText: body,
      attachmentAssetIds: [],
      inReplyToEmailId: email.id,
      accountId: account.id,
      quoteLines: pricedLines,
      subtotalCents: priced.subtotalCents,
      totalCents: priced.totalCents,
      splitProposed: anySplit,
      latencyMs,
      validUntil,
    })) as { approvalId: string };

    return {
      accountId: account.id,
      contactId: contact?.id ?? null,
      requestedLines: requested.map((r, i) => ({ rawText: r.rawText, sku: r.sku, productId: productIds[i] ?? null, qty: r.qty, uom: r.uom })),
      pricedLines,
      subtotalCents: priced.subtotalCents,
      totalCents: priced.totalCents,
      splitProposed: anySplit,
      replyBodyDraft: body,
      approvalId: res.approvalId,
      latencyMs,
    };
  },
});

function displayFirst(email: string): string {
  const local = email.split("@")[0] ?? "there";
  const first = local.split(/[._]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function renderQuoteBody(
  first: string,
  lines: { sku: string; description: string; qty: number; unitPriceCents: number; extendedCents: number; availableNow: number; leadTimeDays: number; splitProposed?: boolean }[],
  totalCents: number,
  anySplit: boolean,
  signoff: string,
  demoNow: Date,
): string {
  const rows = lines
    .map((l) => `  ${l.sku}  ${l.description}  ${l.qty} rolls  @ ${formatCentsExact(l.unitPriceCents)}  = ${formatCentsExact(l.extendedCents)}  (lead ${l.leadTimeDays}d${l.splitProposed ? `; ${l.availableNow} available now, remainder to follow` : ""})`)
    .join("\n");
  const validUntil = new Date(demoNow.getTime() + 30 * 86_400_000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const split = anySplit ? "\n\nA couple of lines are short on stock — I can ship what's available now and backorder the rest so you're not held up.\n" : "";
  return `${first},\n\nHere's the pricing you asked for:\n\n${rows}\n\nTotal: ${formatCentsExact(totalCents)}\nValid through ${validUntil}.${split}\nSend the PO whenever you're ready and I'll turn it same day.\n\n${signoff}`;
}
