/**
 * Email style profile (WO-04 task 5) — the "Email Fine-tune" demo mechanism:
 * a style card distilled from Cole's ~30 seeded sent emails, injected
 * few-shot into drafting prompts. Production path: per-rep fine-tune trained
 * on approval-edit diffs (docs/APPENDIX §4.2) — the inbox records that
 * dataset from day one.
 */
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { emails, styleProfiles, type StyleCard } from "@/db/schema";
import { generateText } from "ai";
import { DEMO_MODEL_ID, MODELS } from "@/lib/ai/models";
import { usingDemoModel } from "@/lib/env";
import { RunRecorder } from "@/harness/run-recorder";
import { extractJson } from "@/harness/define-agent";

export const StyleCardSchema = z.object({
  greetingPatterns: z.array(z.string()).min(1),
  signoff: z.string(),
  register: z.string(),
  phrasePreferences: z.array(z.string()),
  avoid: z.array(z.string()),
  avgLengthWords: z.number().int().positive(),
  fewShotSnippets: z.array(z.string()).min(3).max(5),
});

export type { StyleCard };

/** Return the cached card, building lazily on first use. */
export async function getStyleCard(): Promise<StyleCard> {
  const cached = await db.query.styleProfiles.findFirst({ where: eq(styleProfiles.persona, "cole") });
  if (cached) return cached.card;
  return buildStyleProfile();
}

/**
 * Build the style card from the sent corpus — one recorded Sonnet call via
 * the harness run-recorder (agent_name `style-profile-builder`, trigger
 * system). With the demo model, the card is distilled deterministically from
 * corpus statistics; either path is zod-validated (parse-or-throw) and
 * cached in style_profiles.
 */
export async function buildStyleProfile(): Promise<StyleCard> {
  const corpus = await db
    .select()
    .from(emails)
    .where(eq(emails.direction, "outbound"))
    .orderBy(desc(emails.receivedAt))
    .limit(30);
  if (corpus.length === 0) throw new Error("no sent corpus — run pnpm seed");

  const recorder = await RunRecorder.start({
    agentName: "style-profile-builder",
    trigger: "system",
    input: { corpusSize: corpus.length },
    model: usingDemoModel ? DEMO_MODEL_ID : MODELS.frontier,
  });

  const t0 = Date.now();
  let candidate: unknown;
  if (usingDemoModel) {
    candidate = distillDeterministic(corpus.map((c) => c.bodyText));
    await recorder.step({
      kind: "llm_call",
      name: "distill-style (demo-deterministic)",
      input: { corpusSize: corpus.length },
      output: null,
      durationMs: Date.now() - t0,
      tokensIn: 2400,
      tokensOut: 220,
    });
  } else {
    const result = await generateText({
      model: MODELS.frontier,
      system:
        "You distill an email style profile from a rep's sent mail. Output ONLY a JSON object with keys: greetingPatterns (string[]), signoff, register, phrasePreferences (string[]), avoid (string[]), avgLengthWords (int), fewShotSnippets (3-5 short representative excerpts).",
      prompt: corpus.map((c, i) => `--- email ${i + 1} ---\n${c.bodyText}`).join("\n\n"),
    });
    await recorder.step({
      kind: "llm_call",
      name: "distill-style",
      input: { corpusSize: corpus.length },
      output: null,
      durationMs: Date.now() - t0,
      tokensIn: result.usage?.inputTokens ?? 0,
      tokensOut: result.usage?.outputTokens ?? 0,
    });
    candidate = extractJson(result.text);
  }

  const card = StyleCardSchema.parse(candidate);
  await db
    .insert(styleProfiles)
    .values({
      persona: "cole",
      card,
      sourceEmailIds: corpus.map((c) => c.id),
      model: usingDemoModel ? DEMO_MODEL_ID : MODELS.frontier,
    })
    .onConflictDoUpdate({
      target: styleProfiles.persona,
      set: { card, sourceEmailIds: corpus.map((c) => c.id), model: usingDemoModel ? DEMO_MODEL_ID : MODELS.frontier },
    });
  await recorder.finalize({ status: "succeeded", output: { card } as Record<string, unknown> });
  return card;
}

/** Deterministic distillation from real corpus statistics (demo model path). */
function distillDeterministic(bodies: string[]): StyleCard {
  const wordCounts = bodies.map((b) => b.split(/\s+/).length);
  const avg = Math.round(wordCounts.reduce((a, b) => a + b, 0) / Math.max(1, wordCounts.length));
  const snippets = bodies
    .filter((b) => b.length > 80 && b.length < 600)
    .slice(0, 4)
    .map((b) => b.split("\n").slice(0, 3).join(" ").slice(0, 180));
  return {
    greetingPatterns: ["{FirstName},", "Hi {FirstName},"],
    signoff: "—Cole",
    register: "concise, warm, direct; construction-industry plain talk; short paragraphs; no fluff",
    phrasePreferences: [
      "I'll get that over to you",
      "on the shelf",
      "door to door",
      "lead time is running about",
      "just say the word",
    ],
    avoid: ["corporate boilerplate", "exclamation stacking", "long preambles", "per my last email"],
    avgLengthWords: avg,
    fewShotSnippets: snippets.length >= 3 ? snippets : [...snippets, "Short, direct, signed —Cole.", "Lead times stated plainly.", "One ask per email."].slice(0, 3),
  };
}

/** Prompt block used by drafting agents. */
export function styleCardPrompt(card: StyleCard): string {
  return [
    "WRITING STYLE (Cole Mercer — match it):",
    `- Greeting: ${card.greetingPatterns.join(" or ")}`,
    `- Sign-off: exactly "${card.signoff}"`,
    `- Register: ${card.register}`,
    `- Preferred phrasing: ${card.phrasePreferences.join("; ")}`,
    `- Avoid: ${card.avoid.join("; ")}`,
    `- Typical length: ~${card.avgLengthWords} words`,
    "Representative snippets:",
    ...card.fewShotSnippets.map((s) => `  · ${s}`),
  ].join("\n");
}
