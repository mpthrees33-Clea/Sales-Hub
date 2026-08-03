/**
 * Message Batches wrapper — the ONLY module that talks to the Anthropic API
 * directly (the Batches API is not exposed through the Vercel AI Gateway).
 *
 * Why batch: overnight jobs are latency-insensitive and item-independent, and
 * Message Batches process them at 50% of standard token prices. Scope rule:
 * only single-shot classification/extraction calls are batchable — a batch
 * cannot host an interactive tool loop (every tool round-trip would need a
 * new batch). Batch what's stateless; keep human-in-the-loop agents
 * interactive.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env, usingDemoModel } from "@/lib/env";

/** Live mode + a direct key ⇒ the nightly sweep may use Message Batches. */
export const batchApiEnabled = !usingDemoModel && env.ANTHROPIC_API_KEY !== "";

export type BatchRequest = {
  customId: string;
  system: string;
  /** User turn, already ordered context-first / question-last. */
  user: string;
  maxTokens?: number;
};

export type BatchItemResult =
  | { customId: string; ok: true; text: string; tokensIn: number; tokensOut: number }
  | { customId: string; ok: false; error: string };

export type BatchOutcome = { batchId: string; results: BatchItemResult[] };

type BatchClient = Pick<Anthropic["messages"]["batches"], "create" | "retrieve" | "results" | "cancel">;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Serverless caveat: a Message Batch is ASYNC — Anthropic promises completion
 * within 24h (usually minutes), but a Vercel function can only wait
 * maxDuration seconds. The wait budget must fit the host: on timeout the
 * batch is CANCELLED (so it doesn't bill later for work we redo) and the
 * caller degrades to serial calls. The long-term shape is submit-now /
 * collect-later across two invocations.
 */
export const DEFAULT_BATCH_WAIT_MS = Number(env.BATCH_WAIT_MS || 90_000);

/**
 * Submit → poll until ended → collect. Results stream back in ARBITRARY
 * order, keyed by custom_id — never assume request order.
 */
export async function runMessageBatch(
  model: string,
  reqs: BatchRequest[],
  opts?: { pollMs?: number; timeoutMs?: number; client?: BatchClient },
): Promise<BatchOutcome> {
  const client = opts?.client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }).messages.batches;
  const pollMs = opts?.pollMs ?? 5_000;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_BATCH_WAIT_MS;

  const batch = await client.create({
    requests: reqs.map((r) => ({
      custom_id: r.customId,
      params: {
        model,
        max_tokens: r.maxTokens ?? 1024,
        system: r.system,
        messages: [{ role: "user" as const, content: r.user }],
      },
    })),
  });

  const deadline = Date.now() + timeoutMs;
  let status = batch.processing_status;
  while (status !== "ended") {
    if (Date.now() > deadline) {
      try {
        await client.cancel(batch.id);
      } catch {
        // cancellation is best-effort; the timeout error is what matters
      }
      throw new Error(`message batch ${batch.id} did not finish within ${timeoutMs}ms (status: ${status}); cancelled`);
    }
    await sleep(pollMs);
    status = (await client.retrieve(batch.id)).processing_status;
  }

  const results: BatchItemResult[] = [];
  for await (const entry of await client.results(batch.id)) {
    if (entry.result.type === "succeeded") {
      const msg = entry.result.message;
      const text = msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("");
      results.push({
        customId: entry.custom_id,
        ok: true,
        text,
        tokensIn: msg.usage.input_tokens,
        tokensOut: msg.usage.output_tokens,
      });
    } else {
      results.push({
        customId: entry.custom_id,
        ok: false,
        error: entry.result.type === "errored" ? JSON.stringify(entry.result.error) : entry.result.type,
      });
    }
  }
  return { batchId: batch.id, results };
}
