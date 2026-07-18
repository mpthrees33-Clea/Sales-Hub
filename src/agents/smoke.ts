/**
 * Harness self-test agent (WO-01). Proves end to end: run recording, scoped
 * tools, evidence accumulation, and — critically — that an external-effect
 * tool call becomes a pending approval instead of executing.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { demoState } from "@/db/schema";
import { defineAgent } from "@/harness/define-agent";
import { scopedTool } from "@/harness/tool";
import { MODELS } from "@/lib/ai/models";

const readDemoState = scopedTool({
  name: "readDemoState",
  description: "Read the demo clock singleton (demo_now).",
  effect: "read",
  inputSchema: z.object({}),
  execute: async () => {
    const row = await db.query.demoState.findFirst({ where: eq(demoState.id, 1) });
    if (!row) throw new Error("demo_state missing — run pnpm seed");
    return {
      data: { demoNow: row.demoNow.toISOString(), scenarioVersion: row.scenarioVersion },
      evidence: [
        {
          type: "inventory_row" as const,
          ref: { table: "demo_state", id: 1 },
          quote: `demo_now=${row.demoNow.toISOString()}`,
        },
      ],
    };
  },
});

const sendTestEmail = scopedTool({
  name: "sendTestEmail",
  description: "Send a test email (EXTERNAL — never executes; becomes an approval).",
  effect: "external",
  inputSchema: z.object({
    to: z.array(z.string().email()).min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
  }),
  approval: { kind: "email_draft" },
});

export const smokeAgent = defineAgent({
  name: "smoke",
  description: "Harness self-test: read demo state, queue one gated test email, report.",
  model: MODELS.fast,
  inputSchema: z.object({ note: z.string(), contactEmail: z.string().email() }),
  outputSchema: z.object({ ok: z.boolean(), demoNow: z.string() }),
  tools: [readDemoState, sendTestEmail],
  maxSteps: 4,
  systemPrompt: () =>
    "You are a harness self-test. Call readDemoState, then call sendTestEmail addressed to the seeded contact provided in input (subject 'Harness smoke test', body mentioning the note), then return {ok: true, demoNow}. Do not retry the send tool after it reports queued.",
  demoScript: async ({ input, tools }) => {
    const state = (await tools.readDemoState!({})) as { demoNow: string };
    await tools.sendTestEmail!({
      to: [input.contactEmail],
      subject: "Harness smoke test",
      body: `Self-test note: ${input.note}. This draft was intercepted by the harness — external effects never execute from an agent loop.`,
    });
    return { ok: true, demoNow: state.demoNow };
  },
});
