/**
 * Permissioned Tools (docs/01-ARCHITECTURE.md §5). Every tool declares an
 * effect. `read` and `internal_write` execute normally; `external` NEVER
 * executes from a model loop — the harness intercepts the call and creates an
 * approvals row instead (AI SDK `needsApproval` semantics, enforced in code).
 */
import type { z } from "zod";
import type { Evidence } from "@/db/schema";
import type { approvalKind } from "@/db/schema";

export type ToolEffect = "read" | "internal_write" | "external";
export type ApprovalKind = (typeof approvalKind.enumValues)[number];

export type ToolResult = { data: unknown; evidence?: Evidence[] };

export type ToolRunCtx = {
  runId: string;
  agentName: string;
  demoNow: Date;
};

export type ScopedTool<In = any> = {
  name: string;
  description: string;
  effect: ToolEffect;
  inputSchema: z.ZodType<In>;
  /**
   * Executes for read/internal_write tools. For external tools this is never
   * called from the model loop — the harness converts the call into an
   * approval row. (WO-03's resolution action is the only executor.)
   */
  execute?: (input: In, ctx: ToolRunCtx) => Promise<ToolResult>;
  /** External tools: which approval kind the intercepted call becomes. */
  approval?: {
    kind: ApprovalKind;
    /** Map validated tool input → typed proposed_action payload (default: input as-is). */
    toProposedAction?: (input: In, ctx: ToolRunCtx) => Promise<Record<string, unknown>> | Record<string, unknown>;
  };
};

export function scopedTool<In>(cfg: ScopedTool<In>): ScopedTool<In> {
  if (cfg.effect === "external" && !cfg.approval) {
    throw new Error(`external tool ${cfg.name} must declare approval mapping`);
  }
  if (cfg.effect !== "external" && !cfg.execute) {
    throw new Error(`tool ${cfg.name} (${cfg.effect}) must have execute()`);
  }
  return cfg;
}
