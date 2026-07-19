/**
 * Agent registry — every defineAgent() instance, by name. The interactive
 * dispatcher (/api/agents/[agent]) and the nightly workflow invoke through
 * this registry only.
 */
import type { AgentDef } from "@/harness/define-agent";
import { smokeAgent } from "./smoke";
import { emailTriageAgent } from "./email-triage";
import { emailReplyAgent } from "./email-reply";
import { quoteAgent } from "./quote";

export const agents: Record<string, AgentDef<any, any>> = {
  smoke: smokeAgent,
  "email-triage": emailTriageAgent,
  "email-reply": emailReplyAgent,
  quote: quoteAgent,
};

export function getAgent(name: string) {
  const agent = agents[name];
  if (!agent) throw new Error(`unknown agent: ${name}`);
  return agent;
}
