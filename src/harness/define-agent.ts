/**
 * THE agent harness (docs/01-ARCHITECTURE.md §5). One implementation, many
 * agents — never forked per module.
 *
 * Guarantees, implemented once here:
 *  1. Permissioned Tools — an agent sees only the tools in its allowlist.
 *  2. External-effect interception — `effect:'external'` tools never execute
 *     from the model loop; the call becomes a pending `approvals` row
 *     (needsApproval semantics enforced in code).
 *  3. Run recording — agent_runs + agent_steps for every LLM/tool call,
 *     validation, and escalation; tokens and cost on the run.
 *  4. Evidence accumulation — tool evidence lands on the run output and on
 *     every approval the run creates.
 *  5. Parse-or-escalate — output failing the Zod schema, or a thrown
 *     EscalationError, finishes the run `escalated` (optionally with a
 *     human-input approval). Never silent catch, never guess.
 *
 * Model seam: with AI_GATEWAY_API_KEY set, runs execute a real tool loop via
 * the AI SDK against the Vercel AI Gateway. Without it, the agent's
 * `demoScript` runs instead — a deterministic script that exercises the SAME
 * tool wrappers, interception, recording, and schema validation; only the
 * "thinking" is scripted. Demo mode is first-class (docs/00 §3).
 */
import { generateText, stepCountIs, tool as aiTool, zodSchema } from "ai";
import type { z } from "zod";
import type { Evidence } from "@/db/schema";
import { DEMO_MODEL_ID } from "@/lib/ai/models";
import { audit } from "@/lib/audit";
import { getDemoNow } from "@/lib/demo-clock";
import { usingDemoModel } from "@/lib/env";
import { createApprovalRow } from "./approvals";
import { EscalationError, isEscalation } from "./errors";
import { EvidenceAccumulator } from "./evidence";
import { RunRecorder, type RunTriggerKind, type StepEvent } from "./run-recorder";
import type { ApprovalKind, ScopedTool } from "./tool";

export type RunOpts = {
  trigger: RunTriggerKind;
  workflowRunId?: string;
  dedupKey?: string;
  onStep?: (e: StepEvent) => void;
};

export type AgentRunResult<Out> = {
  runId: string;
  status: "succeeded" | "escalated" | "failed";
  output?: Out;
  approvalIds: string[];
  escalation?: { reason: string; detail: Record<string, unknown> };
  evidence: Evidence[];
  elapsedMs: number;
};

export type RunCtx = { demoNow: Date; trigger: RunTriggerKind };

/** Tool invokers handed to demo scripts — same wrappers the live loop uses. */
export type DemoScriptTools = Record<string, (input: unknown) => Promise<any>>;

export type DemoScriptCtx<In> = {
  input: In;
  tools: DemoScriptTools;
  demoNow: Date;
};

export type AgentDef<In, Out> = {
  name: string;
  description: string;
  model: string;
  inputSchema: z.ZodType<In>;
  outputSchema: z.ZodType<Out>;
  tools: ScopedTool[];
  maxSteps: number;
  systemPrompt: (ctx: RunCtx) => string;
  buildUserContent?: (input: In) => Promise<unknown>;
  run: (input: In, opts: RunOpts) => Promise<AgentRunResult<Out>>;
};

export function defineAgent<In, Out>(cfg: {
  name: string;
  description: string;
  model: string;
  inputSchema: z.ZodType<In>;
  outputSchema: z.ZodType<Out>;
  tools: ScopedTool[];
  maxSteps?: number;
  systemPrompt: (ctx: RunCtx) => string;
  /**
   * Deterministic stand-in for the model when no AI_GATEWAY_API_KEY is set.
   * Receives the same tool wrappers (interception included) and must return
   * a value that passes outputSchema — parse-or-escalate applies equally.
   */
  demoScript?: (ctx: DemoScriptCtx<In>) => Promise<unknown>;
  /**
   * Optional custom user-message content for the live model call (e.g. the
   * po-intake agent attaches the PDF as a native file part). Demo scripts
   * fetch their own inputs.
   */
  buildUserContent?: (input: In) => Promise<unknown>;
  /** Kind for the human-input approval created when this agent escalates. */
  escalationApprovalKind?: ApprovalKind;
  /** Extra context stored on escalation approvals (e.g. source email id). */
  escalationContext?: (input: In) => Record<string, unknown>;
}): AgentDef<In, Out> {
  const maxSteps = cfg.maxSteps ?? 8;

  async function run(rawInput: In, opts: RunOpts): Promise<AgentRunResult<Out>> {
    const input = cfg.inputSchema.parse(rawInput);
    const demoNow = await getDemoNow();
    const model = usingDemoModel ? DEMO_MODEL_ID : cfg.model;
    const startedAt = Date.now();

    const recorder = await RunRecorder.start({
      agentName: cfg.name,
      trigger: opts.trigger,
      input: input as Record<string, unknown>,
      model,
      workflowRunId: opts.workflowRunId,
      dedupKey: opts.dedupKey,
      onStep: opts.onStep,
    });
    await audit({
      actor: `agent:${cfg.name}`,
      action: "run.started",
      objectType: "agent_run",
      objectId: recorder.runId,
      detail: { trigger: opts.trigger },
    });

    const evidence = new EvidenceAccumulator();
    const approvalIds: string[] = [];

    // One wrapper per tool: validation → (interception | execution) → recording.
    const invokeTool = async (t: ScopedTool, rawArgs: unknown): Promise<unknown> => {
      const t0 = Date.now();
      const args = t.inputSchema.parse(rawArgs);
      if (t.effect === "external") {
        // NEVER executes — the call becomes a pending approval row.
        const proposedAction =
          (await t.approval!.toProposedAction?.(args, {
            runId: recorder.runId,
            agentName: cfg.name,
            demoNow,
          })) ?? (args as Record<string, unknown>);
        const { approvalId } = await createApprovalRow({
          runId: recorder.runId,
          agentName: cfg.name,
          kind: t.approval!.kind,
          proposedAction,
          evidence: evidence.all(),
          demoNow,
        });
        approvalIds.push(approvalId);
        const out = { queued: true, approvalId };
        await recorder.step({ kind: "tool_call", name: t.name, input: args, output: out, durationMs: Date.now() - t0 });
        return out;
      }
      const res = await t.execute!(args, { runId: recorder.runId, agentName: cfg.name, demoNow });
      if (res.evidence?.length) evidence.add(...res.evidence);
      await recorder.step({
        kind: "tool_call",
        name: t.name,
        input: args,
        output: res.data,
        durationMs: Date.now() - t0,
      });
      return res.data;
    };

    const finalizeSuccess = async (parsed: Out): Promise<AgentRunResult<Out>> => {
      await recorder.finalize({
        status: "succeeded",
        output: { result: parsed as Record<string, unknown>, evidence: evidence.all() } as Record<string, unknown>,
      });
      await audit({
        actor: `agent:${cfg.name}`,
        action: "run.succeeded",
        objectType: "agent_run",
        objectId: recorder.runId,
        detail: { approvals: approvalIds.length },
      });
      return {
        runId: recorder.runId,
        status: "succeeded",
        output: parsed,
        approvalIds,
        evidence: evidence.all(),
        elapsedMs: Date.now() - startedAt,
      };
    };

    const finalizeEscalated = async (err: EscalationError): Promise<AgentRunResult<Out>> => {
      await recorder.step({
        kind: "escalation",
        name: err.reason,
        input: null,
        output: err.detail,
        durationMs: 0,
      });
      if (cfg.escalationApprovalKind) {
        const { approvalId } = await createApprovalRow({
          runId: recorder.runId,
          agentName: cfg.name,
          kind: cfg.escalationApprovalKind,
          proposedAction: {
            escalation: { reason: err.reason, detail: err.detail },
            ...(cfg.escalationContext?.(input) ?? {}),
          },
          evidence: evidence.all(),
          demoNow,
          riskTier: "standard",
        });
        approvalIds.push(approvalId);
      }
      await recorder.finalize({
        status: "escalated",
        output: { escalation: { reason: err.reason, detail: err.detail }, evidence: evidence.all() },
      });
      await audit({
        actor: `agent:${cfg.name}`,
        action: "run.escalated",
        objectType: "agent_run",
        objectId: recorder.runId,
        detail: { reason: err.reason },
      });
      return {
        runId: recorder.runId,
        status: "escalated",
        approvalIds,
        escalation: { reason: err.reason, detail: err.detail },
        evidence: evidence.all(),
        elapsedMs: Date.now() - startedAt,
      };
    };

    try {
      let candidate: unknown;
      if (usingDemoModel) {
        if (!cfg.demoScript) {
          throw new Error(
            `agent ${cfg.name}: no AI_GATEWAY_API_KEY configured and no demoScript defined — cannot run`,
          );
        }
        const t0 = Date.now();
        const tools: DemoScriptTools = Object.fromEntries(
          cfg.tools.map((t) => [t.name, (args: unknown) => invokeTool(t, args)]),
        );
        candidate = await cfg.demoScript({ input, tools, demoNow });
        const approxIn = Math.ceil(JSON.stringify(input).length / 4) + 600;
        const approxOut = Math.ceil(JSON.stringify(candidate ?? {}).length / 4);
        await recorder.step({
          kind: "llm_call",
          name: "demo-deterministic",
          input: { note: "scripted demo model (no AI_GATEWAY_API_KEY)" },
          output: null,
          durationMs: Date.now() - t0,
          tokensIn: approxIn,
          tokensOut: approxOut,
        });
      } else {
        candidate = await runLiveLoop();
      }

      const parsed = cfg.outputSchema.safeParse(candidate);
      if (!parsed.success) {
        // Grounded or it escalates — schema failure never guesses.
        throw new EscalationError("output_schema_failed", { zodIssues: parsed.error.issues.slice(0, 10) });
      }
      return await finalizeSuccess(parsed.data);
    } catch (err) {
      if (isEscalation(err)) return await finalizeEscalated(err as EscalationError);
      await recorder.finalize({
        status: "failed",
        output: { error: err instanceof Error ? err.message : String(err) },
      });
      await audit({
        actor: `agent:${cfg.name}`,
        action: "run.failed",
        objectType: "agent_run",
        objectId: recorder.runId,
        detail: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }

    async function runLiveLoop(): Promise<unknown> {
      const t0 = Date.now();
      const tools = Object.fromEntries(
        cfg.tools.map((t) => [
          t.name,
          aiTool({
            description: t.description,
            inputSchema: zodSchema(t.inputSchema as z.ZodType<unknown>),
            execute: (args: unknown) => invokeTool(t, args),
          }),
        ]),
      );
      const system =
        cfg.systemPrompt({ demoNow, trigger: opts.trigger }) +
        "\n\nWhen you are done, output ONLY a single JSON object matching the required output schema — no prose around it.";
      const userContent = cfg.buildUserContent ? await cfg.buildUserContent(input) : null;
      const result = await generateText({
        model: cfg.model,
        system,
        ...(userContent
          ? { messages: [{ role: "user" as const, content: userContent as never }] }
          : { prompt: `Input:\n${JSON.stringify(input, null, 2)}` }),
        tools,
        stopWhen: stepCountIs(maxSteps),
      });
      for (const step of result.steps) {
        await recorder.step({
          kind: "llm_call",
          name: "model_step",
          input: null,
          output: { text: step.text?.slice(0, 2000) ?? null },
          durationMs: 0,
          tokensIn: step.usage?.inputTokens ?? 0,
          tokensOut: step.usage?.outputTokens ?? 0,
        });
      }
      void t0;
      return extractJson(result.text);
    }
  }

  return {
    name: cfg.name,
    description: cfg.description,
    model: cfg.model,
    inputSchema: cfg.inputSchema,
    outputSchema: cfg.outputSchema,
    tools: cfg.tools,
    maxSteps,
    systemPrompt: cfg.systemPrompt,
    buildUserContent: cfg.buildUserContent,
    run,
  };
}

/** Pull the final JSON object out of model text (fenced or bare). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new EscalationError("output_schema_failed", { note: "no JSON object in model output" });
  }
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new EscalationError("output_schema_failed", { note: "model output was not valid JSON" });
  }
}
