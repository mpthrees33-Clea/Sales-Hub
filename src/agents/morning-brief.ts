/**
 * morning-brief (WO-08): the runner assembles the deterministic payload
 * (counts, queue digest, docket, KPI snapshot); the model writes only the
 * 2–3 sentence narrative on top. Fast tier, no tools.
 */
import { z } from "zod";
import { defineAgent } from "@/harness/define-agent";
import { MODELS } from "@/lib/ai/models";

export type BriefPayload = {
  counts: {
    triaged: number;
    archived: number;
    drafts: number;
    approvalsPending: number;
    validatedPo: number;
    escalatedPo: number;
    opportunityUpdates: number;
    samples: number;
  };
  queueDigest: { tier: string; kind: string; count: number }[];
  docket: { time: string; title: string; location: string | null }[];
  kpis: { createdWkCents: number; targetWkCents: number; pacePct: number };
  elapsedMs: number;
};

export const morningBriefAgent = defineAgent({
  name: "morning-brief",
  description: "Writes the 2–3 sentence morning narrative over the assembled overnight payload.",
  model: MODELS.fast,
  inputSchema: z.object({ payload: z.custom<BriefPayload>((v) => typeof v === "object" && v !== null) }),
  outputSchema: z.object({ narrative: z.string().min(10) }),
  tools: [],
  maxSteps: 1,
  systemPrompt: () =>
    "You write the top of a sales rep's morning brief: at most 3 sentences, plain and concrete, summarizing what the agents did overnight and what needs the rep's attention first. No hype, no emoji. Output JSON {narrative}.",
  demoScript: async ({ input }) => {
    const p = input.payload;
    const first =
      `Overnight the agents triaged ${p.counts.triaged} emails (${p.counts.archived} archived as noise) and drafted ${p.counts.drafts} replies` +
      (p.counts.validatedPo > 0 ? `, and validated ${p.counts.validatedPo} PO into a draft sales order` : "") +
      (p.counts.escalatedPo > 0 ? `; ${p.counts.escalatedPo} PO escalated on a price mismatch and needs your call` : "") +
      ".";
    const second = `${p.counts.approvalsPending} approvals are waiting — the high-tier sales order first, then the drafts; the low-tier sample confirmations batch-approve in one keystroke.`;
    const third = p.docket.length
      ? `You have ${p.docket.length} stops today starting with ${p.docket[0]!.title} at ${p.docket[0]!.time}; the week is pacing at ${p.kpis.pacePct}% of target.`
      : `The week is pacing at ${p.kpis.pacePct}% of target.`;
    return { narrative: `${first} ${second} ${third}` };
  },
});
