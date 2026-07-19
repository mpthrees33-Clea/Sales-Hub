/**
 * morning-brief (WO-08) — writes the 2-3 sentence narrative atop the assembled
 * brief payload. No tools; composition is deterministic, the model only writes
 * the summary. The runner merges narrative + payload into morning_briefs.
 */
import { z } from "zod";
import { defineAgent } from "@/harness/define-agent";
import { MODELS } from "@/lib/ai/models";

const briefCounts = z.object({
  triaged: z.number(),
  archived: z.number(),
  drafts: z.number(),
  approvalsPending: z.number(),
  validatedPo: z.number(),
  escalatedPo: z.number(),
});

export const morningBriefAgent = defineAgent({
  name: "morning-brief",
  description: "Write the morning-brief narrative from the assembled overnight counts.",
  model: MODELS.fast,
  maxSteps: 1,
  inputSchema: z.object({ counts: briefCounts, docketCount: z.number(), elapsedMs: z.number() }),
  outputSchema: z.object({ narrative: z.string() }),
  tools: [],
  systemPrompt: () => "Write a warm, factual 2-3 sentence morning brief from the overnight counts. No fluff; lead with what the agents did and how long the queue will take.",
  demoScript: async ({ input }) => {
    const c = input.counts;
    const mins = Math.round(input.elapsedMs / 60_000) || 1;
    const narrative =
      `Overnight the agents triaged ${c.triaged} emails (${c.archived} archived as noise) and drafted ${c.drafts} replies, ` +
      `validated ${c.validatedPo} PO into a draft sales order and escalated ${c.escalatedPo} on a price mismatch. ` +
      `${c.approvalsPending} approval${c.approvalsPending === 1 ? "" : "s"} are waiting — the queue clears in about ten minutes, and you have ${input.docketCount} stops on today's docket.`;
    void mins;
    return { narrative };
  },
});
