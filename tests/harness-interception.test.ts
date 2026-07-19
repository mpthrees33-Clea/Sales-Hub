/**
 * External-effect interception (WO-01 acceptance): an agent's external tool
 * call lands as a pending approval instead of executing; escalations record
 * properly; runs and steps are recorded.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { agentRuns, agentSteps, approvals, contacts, emails } from "@/db/schema";
import { defineAgent } from "@/harness/define-agent";
import { EscalationError } from "@/harness/errors";
import { scopedTool } from "@/harness/tool";
import { MODELS } from "@/lib/ai/models";

let contactEmail = "";

beforeAll(async () => {
  const c = await db.select().from(contacts).orderBy(asc(contacts.email)).limit(1);
  if (!c[0]) throw new Error("run pnpm seed before tests");
  contactEmail = c[0].email;
});

const externalTool = scopedTool({
  name: "test_send",
  description: "external test tool",
  effect: "external",
  inputSchema: z.object({ to: z.array(z.string()), subject: z.string() }),
  approval: { kind: "email_draft" },
});

describe("harness interception", () => {
  it("external tool call creates a pending approval and never executes", async () => {
    const agent = defineAgent({
      name: "test-interception",
      description: "test",
      model: MODELS.fast,
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      tools: [externalTool],
      systemPrompt: () => "test",
      demoScript: async ({ tools }) => {
        const res = (await tools.test_send!({ to: [contactEmail], subject: "hi" })) as {
          queued: boolean;
          approvalId: string;
        };
        expect(res.queued).toBe(true);
        return { done: true };
      },
    });

    const emailsBefore = await db.$count(emails);
    const result = await agent.run({}, { trigger: "user" });
    const emailsAfter = await db.$count(emails);

    expect(result.status).toBe("succeeded");
    expect(result.approvalIds).toHaveLength(1);
    expect(emailsAfter).toBe(emailsBefore); // nothing sent

    const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, result.approvalIds[0]!) });
    expect(approval?.status).toBe("pending");
    expect(approval?.kind).toBe("email_draft");

    const run = await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, result.runId) });
    expect(run?.status).toBe("succeeded");
    const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, result.runId));
    expect(steps.some((s) => s.kind === "tool_call" && s.name === "test_send")).toBe(true);
  });

  it("output schema failure escalates (never guesses)", async () => {
    const agent = defineAgent({
      name: "test-schema-escalation",
      description: "test",
      model: MODELS.fast,
      inputSchema: z.object({}),
      outputSchema: z.object({ mustExist: z.string() }),
      tools: [],
      systemPrompt: () => "test",
      demoScript: async () => ({ wrong: true }),
    });
    const result = await agent.run({}, { trigger: "user" });
    expect(result.status).toBe("escalated");
    expect(result.escalation?.reason).toBe("output_schema_failed");
    const run = await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, result.runId) });
    expect(run?.status).toBe("escalated");
  });

  it("explicit EscalationError escalates with detail and records an escalation step", async () => {
    const agent = defineAgent({
      name: "test-explicit-escalation",
      description: "test",
      model: MODELS.fast,
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      tools: [],
      systemPrompt: () => "test",
      demoScript: async () => {
        throw new EscalationError("sku_unresolved", { candidates: ["MS-WG-1147"] });
      },
    });
    const result = await agent.run({}, { trigger: "user" });
    expect(result.status).toBe("escalated");
    expect(result.escalation?.detail).toEqual({ candidates: ["MS-WG-1147"] });
    const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, result.runId));
    expect(steps.some((s) => s.kind === "escalation" && s.name === "sku_unresolved")).toBe(true);
  });
});
