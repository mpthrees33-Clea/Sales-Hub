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
import { poIntakeAgent } from "./po-intake";
import { meetingFollowupAgent } from "./meeting-followup";
import { sampleOrderAgent } from "./sample-order";
import { opportunityUpdateAgent } from "./opportunity-update";
import { morningBriefAgent } from "./morning-brief";
import { roomSceneAgent } from "./room-scene";
import { submittalAgent } from "./submittal";

export const agents: Record<string, AgentDef<any, any>> = {
  smoke: smokeAgent,
  "email-triage": emailTriageAgent,
  "email-reply": emailReplyAgent,
  quote: quoteAgent,
  "po-intake": poIntakeAgent,
  "meeting-followup": meetingFollowupAgent,
  "sample-order": sampleOrderAgent,
  "opportunity-update": opportunityUpdateAgent,
  "morning-brief": morningBriefAgent,
  "room-scene": roomSceneAgent,
  submittal: submittalAgent,
};

export function getAgent(name: string) {
  const agent = agents[name];
  if (!agent) throw new Error(`unknown agent: ${name}`);
  return agent;
}
