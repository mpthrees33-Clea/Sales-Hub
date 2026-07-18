/**
 * Agent registry — every defineAgent() instance, by name. The interactive
 * dispatcher (/api/agents/[agent]) and the nightly workflow invoke through
 * this registry only.
 */
import type { AgentDef } from "@/harness/define-agent";
import { smokeAgent } from "./smoke";

export const agents: Record<string, AgentDef<any, any>> = {
  smoke: smokeAgent,
};

export function getAgent(name: string) {
  const agent = agents[name];
  if (!agent) throw new Error(`unknown agent: ${name}`);
  return agent;
}
