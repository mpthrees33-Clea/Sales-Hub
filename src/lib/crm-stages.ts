/**
 * Opportunity-stage metadata shared across the CRM (pipeline board, account
 * detail, inline editors). Mirrors the `opportunity_stage` pg enum order in
 * src/db/schema.ts. Pure constants — safe to import in client components.
 */
export const STAGE_ORDER = [
  "lead",
  "qualified",
  "specified_bod",
  "quoted",
  "po_received",
  "closed_won",
  "closed_lost",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  specified_bod: "Specified (BOD)",
  quoted: "Quoted",
  po_received: "PO Received",
  closed_won: "Won",
  closed_lost: "Lost",
};

export function stageTone(stage: Stage): "ok" | "warn" | "danger" | "accent" | "muted" {
  if (stage === "closed_won") return "ok";
  if (stage === "closed_lost") return "danger";
  if (stage === "po_received") return "warn";
  if (stage === "lead") return "muted";
  return "accent";
}

export function isOpenStage(stage: Stage): boolean {
  return stage !== "closed_won" && stage !== "closed_lost";
}
