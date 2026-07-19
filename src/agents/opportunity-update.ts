/**
 * opportunity-update (WO-08) — proposes CRM opportunity changes from yesterday's
 * emails/meetings for one account. READ context tool + one external stub
 * (harness → opportunity_update approval). Only changes directly supported by
 * quoted evidence; ambiguous → noChange (a wrong CRM write costs trust).
 */
import { z } from "zod";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { contacts, emails, opportunities, triageRoutings } from "@/db/schema";
import { defineAgent } from "@/harness/define-agent";
import { scopedTool } from "@/harness/tool";
import { MODELS } from "@/lib/ai/models";

type AccountCtx = {
  accountId: string;
  opportunities: { id: string; name: string; stage: string; nextStep: string | null }[];
  routings: { category: string; target: string; emailId: string }[];
  yesterdayEmails: { id: string; subject: string; fromEmail: string }[];
};

const getAccountContext = scopedTool<{ accountId: string; sinceIso: string }>({
  name: "get_account_context",
  description: "Account opportunities, yesterday's triage routings, and yesterday's inbound emails.",
  effect: "read",
  inputSchema: z.object({ accountId: z.string(), sinceIso: z.string() }),
  execute: async ({ accountId, sinceIso }) => {
    const since = new Date(sinceIso);
    const opps = await db.select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage, nextStep: opportunities.nextStep }).from(opportunities).where(eq(opportunities.accountId, accountId));
    // Only THIS account's yesterday inbound emails (from its contacts).
    const acctContacts = await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.accountId, accountId));
    const acctEmailAddrs = new Set(acctContacts.map((c) => c.email));
    const inbound = await db.select({ id: emails.id, subject: emails.subject, fromEmail: emails.fromEmail }).from(emails).where(and(eq(emails.direction, "inbound"), gte(emails.receivedAt, since))).orderBy(desc(emails.receivedAt));
    const acctEmails = inbound.filter((e) => acctEmailAddrs.has(e.fromEmail));
    const emailIds = new Set(acctEmails.map((e) => e.id));
    const allRoutings = await db.select({ category: triageRoutings.category, target: triageRoutings.target, emailId: triageRoutings.emailId }).from(triageRoutings);
    const routings = allRoutings.filter((r) => emailIds.has(r.emailId));
    const ctx: AccountCtx = { accountId, opportunities: opps, routings, yesterdayEmails: acctEmails };
    return { data: { context: ctx } };
  },
});

const proposeOpportunityUpdate = scopedTool<{ accountId: string; opportunityId?: string; fieldDiffs: { field: string; old?: unknown; new?: unknown }[]; rationale: string; newOpportunity?: Record<string, unknown> }>({
  name: "propose_opportunity_update",
  description: "Propose an opportunity change (EXTERNAL — becomes an opportunity_update approval).",
  effect: "external",
  inputSchema: z.object({
    accountId: z.string(),
    opportunityId: z.string().optional(),
    fieldDiffs: z.array(z.object({ field: z.string(), old: z.unknown(), new: z.unknown() })),
    rationale: z.string(),
    newOpportunity: z.record(z.string(), z.unknown()).optional(),
  }),
  approval: { kind: "opportunity_update" },
});

const outputSchema = z.object({
  updates: z.array(z.object({ opportunityId: z.string().optional(), diffs: z.array(z.object({ field: z.string(), old: z.unknown(), new: z.unknown() })), rationale: z.string() })),
  noChange: z.boolean(),
});

export const opportunityUpdateAgent = defineAgent({
  name: "opportunity-update",
  description: "Propose evidence-backed opportunity changes from yesterday's activity for one account.",
  model: MODELS.frontier,
  maxSteps: 6,
  inputSchema: z.object({ accountId: z.string(), sinceIso: z.string() }),
  outputSchema,
  tools: [getAccountContext, proposeOpportunityUpdate],
  systemPrompt: () =>
    "Propose only changes directly supported by quoted evidence from yesterday's emails/transcripts (stage moves, value changes, next steps, new opportunity mentions); " +
    "one approval per opportunity; when evidence is ambiguous, prefer noChange — a wrong CRM write costs trust.",
  demoScript: async ({ input, tools }) => {
    const { context } = (await tools.get_account_context!({ accountId: input.accountId, sinceIso: input.sinceIso })) as { context: AccountCtx };
    const updates: { opportunityId?: string; diffs: { field: string; old: unknown; new: unknown }[]; rationale: string }[] = [];

    const hasPo = context.routings.some((r) => r.target === "po_intake");
    const hasQuote = context.routings.some((r) => r.target === "quote");

    // A PO landed against a quoted opportunity → move it to po_received.
    const quotedOpp = context.opportunities.find((o) => o.stage === "quoted");
    if (hasPo && quotedOpp) {
      const diffs = [{ field: "stage", old: "quoted", new: "po_received" }];
      await tools.propose_opportunity_update!({ accountId: input.accountId, opportunityId: quotedOpp.id, fieldDiffs: diffs, rationale: "PO received against the outstanding quote." });
      updates.push({ opportunityId: quotedOpp.id, diffs, rationale: "PO received against the outstanding quote." });
    } else if (hasQuote && context.opportunities[0]) {
      // A fresh quote request → advance next step.
      const opp = context.opportunities[0];
      const diffs = [{ field: "next_step", old: opp.nextStep, new: "Pricing requested — quote in progress" }];
      await tools.propose_opportunity_update!({ accountId: input.accountId, opportunityId: opp.id, fieldDiffs: diffs, rationale: "New pricing request received yesterday." });
      updates.push({ opportunityId: opp.id, diffs, rationale: "New pricing request received yesterday." });
    }

    return { updates, noChange: updates.length === 0 };
  },
});
