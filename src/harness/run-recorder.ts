/**
 * Run recording (docs/01-ARCHITECTURE.md §5.3). Every run → agent_runs; every
 * LLM call / tool call / validation / escalation → agent_steps. Agent authors
 * write zero logging code — the harness owns this.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agentRuns, agentSteps } from "@/db/schema";
import { DEMO_MODEL_ID, MODEL_PRICING_PER_MTOK } from "@/lib/ai/models";

export type StepKind = "llm_call" | "tool_call" | "validation" | "escalation" | "workflow_step";
export type RunTriggerKind = "nightly" | "user" | "workflow" | "system";

export type StepEvent = {
  seq: number;
  kind: StepKind;
  name: string;
  durationMs: number;
};

export class RunRecorder {
  readonly runId: string;
  readonly agentName: string;
  private seq = 0;
  private tokensIn = 0;
  private tokensOut = 0;
  private model: string;
  private onStep?: (e: StepEvent) => void;

  private constructor(runId: string, agentName: string, model: string, onStep?: (e: StepEvent) => void) {
    this.runId = runId;
    this.agentName = agentName;
    this.model = model;
    this.onStep = onStep;
  }

  static async start(opts: {
    agentName: string;
    trigger: RunTriggerKind;
    input: Record<string, unknown>;
    model: string;
    workflowRunId?: string;
    dedupKey?: string;
    onStep?: (e: StepEvent) => void;
  }): Promise<RunRecorder> {
    const [row] = await db
      .insert(agentRuns)
      .values({
        agentName: opts.agentName,
        trigger: opts.trigger,
        input: opts.input,
        model: opts.model,
        status: "running",
        workflowRunId: opts.workflowRunId,
        dedupKey: opts.dedupKey,
      })
      .returning({ id: agentRuns.id });
    return new RunRecorder(row!.id, opts.agentName, opts.model, opts.onStep);
  }

  async step(entry: {
    kind: StepKind;
    name: string;
    input?: unknown;
    output?: unknown;
    durationMs: number;
    tokensIn?: number;
    tokensOut?: number;
  }): Promise<void> {
    this.seq += 1;
    this.tokensIn += entry.tokensIn ?? 0;
    this.tokensOut += entry.tokensOut ?? 0;
    await db.insert(agentSteps).values({
      runId: this.runId,
      seq: this.seq,
      kind: entry.kind,
      name: entry.name,
      input: pruneForLog(entry.input),
      output: pruneForLog(entry.output),
      durationMs: Math.round(entry.durationMs),
    });
    this.onStep?.({ seq: this.seq, kind: entry.kind, name: entry.name, durationMs: entry.durationMs });
  }

  costUsd(): number {
    const pricing = MODEL_PRICING_PER_MTOK[this.model] ?? MODEL_PRICING_PER_MTOK[DEMO_MODEL_ID]!;
    return (this.tokensIn * pricing.in + this.tokensOut * pricing.out) / 1_000_000;
  }

  async finalize(opts: {
    status: "succeeded" | "escalated" | "failed";
    output?: Record<string, unknown>;
  }): Promise<void> {
    await db
      .update(agentRuns)
      .set({
        status: opts.status,
        output: opts.output,
        tokensIn: this.tokensIn,
        tokensOut: this.tokensOut,
        costUsd: this.costUsd().toFixed(6),
        finishedAt: sql`now()`,
      })
      .where(eq(agentRuns.id, this.runId));
  }
}

/** Keep step payloads log-sized — refs, not full documents. */
function pruneForLog(v: unknown): unknown {
  if (v === undefined) return null;
  const s = JSON.stringify(v);
  if (s && s.length > 20_000) {
    return { _truncated: true, preview: s.slice(0, 2_000) };
  }
  return v;
}
