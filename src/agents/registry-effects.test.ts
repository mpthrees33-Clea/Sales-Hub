/**
 * WO-04 security invariant: lethal-trifecta separation is structural, not
 * prompted. email-triage (reads untrusted mail) holds NO external-effect tools;
 * email-reply holds exactly one — the harness-wrapped draft creator.
 */
import { describe, expect, it } from "vitest";
import "@/lib/load-env";
import { emailReplyAgent } from "@/agents/email-reply";
import { emailTriageAgent } from "@/agents/email-triage";

describe("agent tool effect allowlists", () => {
  it("email-triage holds zero external-effect tools", () => {
    const external = emailTriageAgent.tools.filter((t) => t.effect === "external");
    expect(external).toHaveLength(0);
  });

  it("email-reply holds exactly one external-effect tool (create_email_draft)", () => {
    const external = emailReplyAgent.tools.filter((t) => t.effect === "external");
    expect(external).toHaveLength(1);
    expect(external[0]!.name).toBe("create_email_draft");
    expect(external[0]!.approval?.kind).toBe("email_draft");
  });
});
