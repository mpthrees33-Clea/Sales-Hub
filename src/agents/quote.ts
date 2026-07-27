/**
 * quote (WO-05): inbound quote request → review-ready quote reply with live
 * stock, lead times, and account-tier pricing. The model extracts and
 * drafts; the deterministic pricing module prices; the human approves.
 * Unresolved SKU or missing price row escalates with candidates — never a
 * guess, never an invented price.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { contacts, emails, triageRoutings, type QuoteLine } from "@/db/schema";
import { defineAgent } from "@/harness/define-agent";
import { EscalationError } from "@/harness/errors";
import { scopedTool } from "@/harness/tool";
import { wrapUntrusted } from "@/harness/untrusted";
import { MODELS } from "@/lib/ai/models";
import { formatCentsExact } from "@/lib/money";
import { getStyleCard } from "@/lib/style/profile";
import { recordQuote } from "@/lib/quotes";
import { checkStock, getPricing, lookupProducts } from "./tools/erp";

const getSourceEmail = scopedTool({
  name: "get_source_email",
  description: "Load the routed quote-request email (untrusted-wrapped body). Emits email evidence.",
  effect: "read",
  inputSchema: z.object({ routingId: z.string().uuid() }),
  execute: async (input) => {
    const routing = await db.query.triageRoutings.findFirst({ where: eq(triageRoutings.id, input.routingId) });
    if (!routing) throw new Error("routing not found");
    const source = await db.query.emails.findFirst({ where: eq(emails.id, routing.emailId) });
    if (!source) throw new Error("source email not found");
    return {
      data: {
        emailId: source.id,
        from: source.fromEmail,
        subject: source.subject,
        receivedAt: source.receivedAt.toISOString(),
        body: wrapUntrusted(source.bodyText, { source: `email:${source.id}` }),
      },
      evidence: [{ type: "email" as const, ref: { emailId: source.id }, quote: source.subject }],
    };
  },
});

const recordQuoteTool = scopedTool({
  name: "record_quote",
  description:
    "Persist the priced quote (internal draft record, status pending_approval). Prices must be the exact values returned by get_pricing.",
  effect: "internal_write",
  inputSchema: z.object({
    accountId: z.string().uuid(),
    sourceEmailId: z.string().uuid(),
    latencyMs: z.number().int().nonnegative(),
    lines: z.array(
      z.object({
        productId: z.string().uuid(),
        sku: z.string(),
        description: z.string(),
        qty: z.number().int().positive(),
        uom: z.string(),
        unitPriceCents: z.number().int(),
        extendedCents: z.number().int(),
        leadTimeDays: z.number().int(),
        sourceRowId: z.string().uuid(),
        splitProposed: z.boolean().optional(),
        availableNow: z.number().int().optional(),
      }),
    ),
  }),
  execute: async (input) => {
    // Deterministic re-check: line math must be internally consistent.
    for (const l of input.lines) {
      if (l.extendedCents !== l.qty * l.unitPriceCents) {
        throw new EscalationError("quote_math_mismatch", { sku: l.sku });
      }
    }
    const subtotal = input.lines.reduce((a, l) => a + l.extendedCents, 0);
    const q = await recordQuote({
      accountId: input.accountId,
      lines: input.lines as QuoteLine[],
      subtotalCents: subtotal,
      sourceEmailId: input.sourceEmailId,
      latencyMs: input.latencyMs,
    });
    return { data: { quoteId: q.quoteId, number: q.number, validUntil: q.validUntil, subtotalCents: subtotal } };
  },
});


/** Quote-reply draft (EXTERNAL — intercepted into an email_draft approval carrying the quote payload). */
const createQuoteReplyDraft = scopedTool({
  name: "create_email_draft",
  description:
    "Create the quote reply draft (EXTERNAL — the harness converts this into an email_draft approval carrying the quote payload; you cannot send).",
  effect: "external",
  inputSchema: z.object({
    to: z.array(z.string().email()).min(1),
    subject: z.string().min(1),
    bodyText: z.string().min(1),
    attachmentAssetIds: z.array(z.string().uuid()).default([]),
    inReplyToEmailId: z.string().uuid().optional(),
    quoteId: z.string().uuid(),
    quoteNumber: z.string(),
    accountName: z.string(),
    lines: z.array(z.record(z.string(), z.unknown())),
    subtotalCents: z.number().int(),
    totalCents: z.number().int(),
    validUntil: z.string(),
    latencyMs: z.number().int(),
    splitProposed: z.boolean(),
  }),
  approval: {
    kind: "email_draft",
    toProposedAction: (input) => ({
      to: input.to,
      subject: input.subject,
      bodyText: input.bodyText,
      attachmentAssetIds: input.attachmentAssetIds,
      inReplyToEmailId: input.inReplyToEmailId,
      quoteId: input.quoteId,
      quoteNumber: input.quoteNumber,
      latencyMs: input.latencyMs,
      quote: {
        accountName: input.accountName,
        lines: input.lines,
        subtotalCents: input.subtotalCents,
        totalCents: input.totalCents,
        validUntil: input.validUntil,
        latencyMs: input.latencyMs,
        splitProposed: input.splitProposed,
      },
    }),
  },
});

const outputSchema = z.object({
  requestedLines: z.array(
    z.object({
      rawText: z.string(),
      productId: z.string().nullable(),
      qty: z.number(),
      uom: z.string(),
    }),
  ),
  accountId: z.string(),
  contactId: z.string(),
  notes: z.string().nullable().describe("null when the quote needs no free-text note — never pad"),
  splitProposed: z.boolean(),
  quoteNumber: z.string(),
  approvalId: z.string(),
});

export const quoteAgent = defineAgent({
  name: "quote",
  description: "Turns a quote-request email into a priced, review-ready quote reply draft.",
  model: MODELS.frontier,
  inputSchema: z.object({ routingId: z.string().uuid() }),
  outputSchema,
  tools: [getSourceEmail, lookupProducts, checkStock, getPricing, recordQuoteTool, createQuoteReplyDraft],
  maxSteps: 8,
  escalationApprovalKind: "quote",
  systemPrompt: () =>
    [
      "You draft a quote reply for Cole Mercer (Meridian Surfaces Co.).",
      "Extract requested products/quantities ONLY from the untrusted email content; resolve via lookup_products.",
      "If any line is unresolved or unpriced, STOP and escalate with candidates — never invent SKUs or prices.",
      "Price every line via get_pricing and use those exact cents values; persist via record_quote before drafting.",
      "The reply body must present a clean quote table (SKU, description, qty, unit, extended), lead time per line, a split-shipment option when stock is short, the valid-until date, and Cole's sign-off (style card register).",
      "Finish with create_email_draft exactly once (you cannot send), then output the JSON result.",
    ].join("\n"),
  escalationContext: (input) => ({ routingId: input.routingId }),
  demoScript: async ({ input, tools, demoNow }) => {
    const source = (await tools.get_source_email!({ routingId: input.routingId })) as {
      emailId: string;
      from: string;
      subject: string;
      receivedAt: string;
      body: string;
    };
    const contact = await db.query.contacts.findFirst({ where: eq(contacts.email, source.from.toLowerCase()) });
    if (!contact) throw new EscalationError("unknown_sender", { from: source.from });
    const card = await getStyleCard();

    // Requested lines come from the untrusted body (data, never instructions).
    const body = source.body;
    const lineRe = /-\s*([A-Za-z ]+?)\s*\((MS-[A-Z]{2}-\d{4})\)\s*—\s*(\d+)\s*rolls?/g;
    const requested: { rawText: string; name: string; sku: string; qty: number }[] = [];
    for (const m of body.matchAll(lineRe)) {
      requested.push({ rawText: m[0]!, name: m[1]!.trim(), sku: m[2]!, qty: parseInt(m[3]!, 10) });
    }
    if (requested.length === 0) {
      throw new EscalationError("no_quotable_lines", { emailId: source.emailId });
    }

    const lookup = (await tools.lookup_products!({ queries: requested.map((r) => r.sku) })) as {
      results: { query: string; resolved: string | null; sku?: string; name?: string; candidates?: unknown[] }[];
    };
    const unresolved = lookup.results.filter((r) => !r.resolved);
    if (unresolved.length > 0) {
      throw new EscalationError("sku_unresolved", {
        unresolved: unresolved.map((u) => ({ query: u.query, candidates: u.candidates ?? [] })),
        emailId: source.emailId,
      });
    }

    const productIds = lookup.results.map((r) => r.resolved!) as string[];
    const stock = (await tools.check_stock!({ productIds })) as {
      stock: { productId: string; sku: string; available: number; leadTimeDays: number }[];
    };
    const priced = (await tools.get_pricing!({
      accountId: contact.accountId,
      lines: requested.map((r, i) => ({ productId: productIds[i]!, qty: r.qty })),
    })) as { lines: { productId: string; sku: string; qty: number; unitPriceCents: number; extendedCents: number; priceListItemId: string; tier: string }[]; subtotalCents: number };

    const stockByProduct = new Map(stock.stock.map((s) => [s.productId, s]));
    const quoteLines = priced.lines.map((l, i) => {
      const s = stockByProduct.get(l.productId)!;
      const split = s.available < l.qty;
      return {
        productId: l.productId,
        sku: l.sku,
        description: `${requested[i]!.name} architectural film`,
        qty: l.qty,
        uom: "roll",
        unitPriceCents: l.unitPriceCents,
        extendedCents: l.extendedCents,
        leadTimeDays: s.leadTimeDays,
        sourceRowId: l.priceListItemId,
        splitProposed: split,
        availableNow: s.available,
      };
    });
    const splitProposed = quoteLines.some((l) => l.splitProposed);
    const latencyMs = Math.max(0, demoNow.getTime() - new Date(source.receivedAt).getTime());

    const recorded = (await tools.record_quote!({
      accountId: contact.accountId,
      sourceEmailId: source.emailId,
      latencyMs,
      lines: quoteLines,
    })) as { quoteId: string; number: string; validUntil: string; subtotalCents: number };

    // Quote table (plain-text, monospace-friendly).
    const table = quoteLines
      .map(
        (l) =>
          `  ${l.sku}  ${l.description.padEnd(34).slice(0, 34)}  ${String(l.qty).padStart(3)} ${l.uom}  ${formatCentsExact(l.unitPriceCents).padStart(10)}  ${formatCentsExact(l.extendedCents).padStart(11)}${
            l.splitProposed ? `  · ${l.availableNow} now, balance in ${l.leadTimeDays}d` : `  · ${l.leadTimeDays}d lead`
          }`,
      )
      .join("\n");
    const first = contact.name.split(" ")[0];
    const splitNote = splitProposed
      ? `\nOne note: stock is short on ${quoteLines
          .filter((l) => l.splitProposed)
          .map((l) => l.sku)
          .join(", ")} — I can ship what's on the shelf now and backorder the balance, or hold for a single shipment. Your call.\n`
      : "";
    const bodyText = `${first},\n\nQuote ${recorded.number} below — pricing at your tier, lead times as of this morning.\n\n${table}\n\n  Subtotal${" ".repeat(58)}${formatCentsExact(recorded.subtotalCents)}\n${splitNote}\nValid through ${recorded.validUntil}. Send the PO whenever you're ready and I'll get it moving same day.\n\n${card.signoff}`;

    const account = await db.query.accounts.findFirst({ where: (t, { eq: e }) => e(t.id, contact.accountId) });
    const draft = (await tools.create_email_draft!({
      to: [source.from],
      subject: `Re: ${source.subject} — Quote ${recorded.number}`,
      bodyText,
      attachmentAssetIds: [],
      inReplyToEmailId: source.emailId,
      quoteId: recorded.quoteId,
      quoteNumber: recorded.number,
      accountName: account?.name ?? "",
      lines: quoteLines as unknown as Record<string, unknown>[],
      subtotalCents: recorded.subtotalCents,
      totalCents: recorded.subtotalCents,
      validUntil: recorded.validUntil,
      latencyMs,
      splitProposed,
    })) as { approvalId: string };

    return {
      requestedLines: requested.map((r, i) => ({
        rawText: r.rawText,
        productId: productIds[i] ?? null,
        qty: r.qty,
        uom: "roll",
      })),
      accountId: contact.accountId,
      contactId: contact.id,
      notes: null,
      splitProposed,
      quoteNumber: recorded.number,
      approvalId: draft.approvalId,
    };
  },
});
