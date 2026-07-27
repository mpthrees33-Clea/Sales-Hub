/**
 * Long-context prompt ordering: documents/transcripts go FIRST in the user
 * turn, the task instruction goes LAST — model attention is strongest at the
 * start and end of the prompt, and query-after-document measurably improves
 * grounded extraction on long inputs.
 */
import "@/lib/load-env";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blob", () => ({
  getBlobBuffer: vi.fn(async () => Buffer.from("%PDF-1.4 fake")),
}));

import { meetingFollowupAgent } from "@/agents/meeting-followup";
import { poIntakeAgent } from "@/agents/po-intake";

type Part = { type: string; text?: string; mediaType?: string };

describe("prompt ordering — document first, instruction last", () => {
  it("po-intake sends the PDF before the extraction instruction", async () => {
    const parts = (await poIntakeAgent.buildUserContent!({
      blobUrl: "/api/blob/fake.pdf",
    })) as Part[];
    expect(parts).toHaveLength(2);
    expect(parts[0]!.type).toBe("file");
    expect(parts[0]!.mediaType).toBe("application/pdf");
    expect(parts[1]!.type).toBe("text");
    expect(parts[1]!.text).toMatch(/extract the purchase order above/i);
  });

  it("meeting-followup sends the wrapped transcript before the task instruction", async () => {
    const meetingId = randomUUID();
    const parts = (await meetingFollowupAgent.buildUserContent!({
      meetingId,
      transcript: [{ speaker: "Ray", t0: 0, t1: 5, text: "let's talk pricing" }],
    })) as Part[];
    expect(parts).toHaveLength(2);
    expect(parts[0]!.type).toBe("text");
    expect(parts[0]!.text).toMatch(/^<untrusted_content/);
    expect(parts[0]!.text).toContain("let's talk pricing");
    expect(parts[1]!.type).toBe("text");
    expect(parts[1]!.text).toContain(meetingId);
    expect(parts[1]!.text).toMatch(/transcript above/i);
  });
});
