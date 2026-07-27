/**
 * Schema-repair loop: when live output fails validation, the harness feeds
 * the Zod issues back to the model ONCE for a corrected submit_result call,
 * and only escalates if the retry also fails — repair before escalation,
 * never a silent guess.
 */
import "@/lib/load-env";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  usingDemoModel: false, // force the live loop; generateText below is mocked
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

import { generateText } from "ai";
import { defineAgent } from "@/harness/define-agent";

const mockedGenerate = vi.mocked(generateText);

const makeAgent = () =>
  defineAgent({
    name: "smoke",
    description: "repair-loop test double",
    model: "anthropic/claude-haiku-4.5",
    inputSchema: z.object({ q: z.string() }),
    outputSchema: z.object({ val: z.number() }),
    tools: [],
    maxSteps: 1,
    systemPrompt: () => "test",
  });

const modelTurn = (text: string) =>
  ({ text, steps: [], response: { messages: [] } }) as never;

describe("schema-repair loop (live path)", () => {
  it("repairs a failed output once, passing the zod issues back", async () => {
    mockedGenerate.mockReset();
    mockedGenerate
      .mockResolvedValueOnce(modelTurn('{"val":"not-a-number"}'))
      .mockResolvedValueOnce(modelTurn('{"val":42}'));

    const result = await makeAgent().run({ q: "x" }, { trigger: "user" });

    expect(result.status).toBe("succeeded");
    expect(result.output).toEqual({ val: 42 });
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
    const repairCall = mockedGenerate.mock.calls[1]![0] as { messages: { role: string; content: unknown }[] };
    const lastMsg = repairCall.messages.at(-1)!;
    expect(lastMsg.role).toBe("user");
    expect(String(lastMsg.content)).toContain("failed schema validation");
    expect(String(lastMsg.content)).toContain("val"); // the zod issue path made it back
  });

  it("escalates when the repair attempt also fails", async () => {
    mockedGenerate.mockReset();
    mockedGenerate
      .mockResolvedValueOnce(modelTurn('{"val":"still"}'))
      .mockResolvedValueOnce(modelTurn('{"val":"wrong"}'));

    const result = await makeAgent().run({ q: "x" }, { trigger: "user" });

    expect(result.status).toBe("escalated");
    expect(result.escalation?.reason).toBe("output_schema_failed");
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
  });
});
