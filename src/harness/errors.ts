/**
 * Typed escalation ("Grounded or it escalates"). Agents and validation steps
 * throw EscalationError; the harness converts it into an escalated run plus a
 * human-input approval. Never silent catch, never guess.
 */
export class EscalationError extends Error {
  readonly reason: string;
  readonly detail: Record<string, unknown>;

  constructor(reason: string, detail: Record<string, unknown> = {}) {
    super(`escalation: ${reason}`);
    this.name = "EscalationError";
    this.reason = reason;
    this.detail = detail;
  }
}

export function isEscalation(e: unknown): e is EscalationError {
  return e instanceof EscalationError || (e instanceof Error && e.name === "EscalationError");
}
