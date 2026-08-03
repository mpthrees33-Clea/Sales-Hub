/**
 * Message Batches layer: results are re-keyed by custom_id (arrival order is
 * arbitrary), errored items surface as ok:false (the caller degrades them to
 * serial runs), the batch path is provably OFF in this keyless environment,
 * and batch prompts follow the context-first / question-last ordering rule.
 */
import "@/lib/load-env";
import { desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { buildTriagePrompt } from "@/agents/email-triage-batch";
import { db } from "@/db/client";
import { emails } from "@/db/schema";
import { batchApiEnabled, runMessageBatch } from "@/lib/ai/anthropic-batch";

const fakeClient = (entries: unknown[]) => {
  const calls: unknown[] = [];
  return {
    calls,
    create: async (body: unknown) => {
      calls.push(body);
      return { id: "msgbatch_test", processing_status: "ended" as const };
    },
    retrieve: async () => ({ id: "msgbatch_test", processing_status: "ended" as const }),
    results: async () =>
      (async function* () {
        yield* entries as never[];
      })(),
  };
};

const succeeded = (customId: string, text: string) => ({
  custom_id: customId,
  result: {
    type: "succeeded",
    message: {
      content: [{ type: "text", text }],
      usage: { input_tokens: 100, output_tokens: 20 },
    },
  },
});

describe("runMessageBatch", () => {
  it("re-keys out-of-order results by custom_id and maps errors to ok:false", async () => {
    const client = fakeClient([
      succeeded("email-B", '{"category":"noise"}'),
      { custom_id: "email-C", result: { type: "errored", error: { type: "invalid_request" } } },
      succeeded("email-A", '{"category":"po"}'),
    ]);
    const { batchId, results } = await runMessageBatch(
      "claude-haiku-4-5",
      [
        { customId: "email-A", system: "s", user: "u" },
        { customId: "email-B", system: "s", user: "u" },
        { customId: "email-C", system: "s", user: "u" },
      ],
      { client: client as never, pollMs: 1 },
    );
    expect(batchId).toBe("msgbatch_test");
    const byId = new Map(results.map((r) => [r.customId, r]));
    expect(byId.get("email-A")).toMatchObject({ ok: true, text: '{"category":"po"}', tokensIn: 100 });
    expect(byId.get("email-B")).toMatchObject({ ok: true, text: '{"category":"noise"}' });
    expect(byId.get("email-C")).toMatchObject({ ok: false });
    // one request per item went up, in our order
    const sent = (client.calls[0] as { requests: { custom_id: string }[] }).requests.map((r) => r.custom_id);
    expect(sent).toEqual(["email-A", "email-B", "email-C"]);
  });
});

describe("batch gating", () => {
  it("is OFF without keys — nightly/demo suites run the serial deterministic path", () => {
    expect(batchApiEnabled).toBe(false);
  });
});

describe("batch prompt shape", () => {
  let anyEmail: typeof emails.$inferSelect;
  beforeAll(async () => {
    const row = await db.query.emails.findFirst({
      where: eq(emails.direction, "inbound"),
      orderBy: desc(emails.receivedAt),
    });
    if (!row) throw new Error("no seeded inbound email — run pnpm seed");
    anyEmail = row;
  });

  it("puts the context block first and the question last", async () => {
    const { user } = await buildTriagePrompt(anyEmail);
    expect(user.startsWith("EMAIL CONTEXT")).toBe(true);
    expect(user.trimEnd().endsWith("output the JSON object.")).toBe(true);
    expect(user.indexOf("Subject:")).toBeLessThan(user.indexOf("Classify this email"));
  });
});
