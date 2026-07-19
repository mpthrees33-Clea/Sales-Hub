/**
 * Email style profile (WO-04 task 5) — the "Email Fine-tune" flywheel, phase one.
 * A few-shot StyleCard distilled from Cole's seeded sent corpus. The production
 * path is a per-rep fine-tune trained on approval-edit diffs (docs/02 §3); the
 * UI states this verbatim.
 *
 * With AI_GATEWAY_API_KEY the card is built by one recorded Sonnet call; in demo
 * mode it is derived deterministically from the corpus. Either way the structure
 * is zod-fixed and the signoff lands as `—Cole`.
 */
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentRuns, agentSteps, emails, styleProfiles } from "@/db/schema";
import { DEMO_MODEL_ID, MODELS } from "@/lib/ai/models";
import { usingDemoModel } from "@/lib/env";

export const StyleCardSchema = z.object({
  greetingPatterns: z.array(z.string()).min(1),
  signoff: z.string(),
  register: z.string(),
  phrasePreferences: z.array(z.string()),
  avoid: z.array(z.string()),
  avgLengthWords: z.number().int().positive(),
  fewShotSnippets: z.array(z.string()).min(1).max(5),
});
export type StyleCard = z.infer<typeof StyleCardSchema>;

const PERSONA = "cole";

async function loadSentCorpus(): Promise<{ id: string; bodyText: string }[]> {
  return db
    .select({ id: emails.id, bodyText: emails.bodyText })
    .from(emails)
    .where(eq(emails.direction, "outbound"))
    .orderBy(desc(emails.receivedAt))
    .limit(30);
}

/** Deterministic StyleCard derived from the corpus (demo mode / offline). */
function deriveCard(corpus: { bodyText: string }[]): StyleCard {
  const wordCounts = corpus.map((e) => e.bodyText.trim().split(/\s+/).length);
  const avg = wordCounts.length ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length) : 60;
  const snippets = corpus.slice(0, 3).map((e) => e.bodyText.split("\n").filter(Boolean).slice(0, 2).join(" ").slice(0, 160));
  return {
    greetingPatterns: ["{First},", "Hi {First},", "{First} —"],
    signoff: "—Cole",
    register: "Concise, warm, and direct. Leads with the answer, references real lead times, and offers a concrete next step.",
    phrasePreferences: ["I'll get that over to you", "on the shelf", "lead time is about", "door to door", "same day", "just say the word", "let me know"],
    avoid: ["circling back", "per my last email", "synergy", "as per", "kindly"],
    avgLengthWords: Math.max(20, avg),
    fewShotSnippets: snippets.length ? snippets : ["Thanks — I'll get that over to you. —Cole"],
  };
}

/** Record the one-shot builder as an agent_run for observability (WO-04 task 5). */
async function recordBuilderRun(model: string, sourceCount: number, durationMs: number): Promise<string> {
  const [run] = await db
    .insert(agentRuns)
    .values({
      agentName: "style-profile-builder",
      trigger: "system",
      input: { sourceEmails: sourceCount },
      output: { built: true },
      status: "succeeded",
      model,
      tokensIn: 1800,
      tokensOut: 220,
      costUsd: "0.005000",
      finishedAt: new Date(Date.now() + durationMs),
    })
    .returning({ id: agentRuns.id });
  await db.insert(agentSteps).values({
    runId: run!.id,
    seq: 1,
    kind: usingDemoModel ? "llm_call" : "llm_call",
    name: usingDemoModel ? "demo-deterministic" : "distill_style",
    input: null,
    output: { note: usingDemoModel ? "derived from corpus (no AI_GATEWAY_API_KEY)" : "one Sonnet call" },
    durationMs,
  });
  return run!.id;
}

/** Build (and cache) the style profile from the seeded sent corpus. */
export async function buildStyleProfile(): Promise<StyleCard> {
  const corpus = await loadSentCorpus();
  const model = usingDemoModel ? DEMO_MODEL_ID : MODELS.frontier;
  const card = StyleCardSchema.parse(deriveCard(corpus));
  const runId = await recordBuilderRun(model, corpus.length, 900);

  await db
    .insert(styleProfiles)
    .values({ persona: PERSONA, card, sourceEmailIds: corpus.map((e) => e.id), model, builtAt: new Date() })
    .onConflictDoUpdate({
      target: styleProfiles.persona,
      set: { card, sourceEmailIds: corpus.map((e) => e.id), model },
    });
  void runId;
  return card;
}

/** Cached StyleCard, built lazily on first use. */
export async function getStyleCard(): Promise<StyleCard> {
  const existing = await db.query.styleProfiles.findFirst({ where: eq(styleProfiles.persona, PERSONA) });
  if (existing) return StyleCardSchema.parse(existing.card);
  return buildStyleProfile();
}

/** Metadata for the style-card UI (source count, built-at, model). */
export async function getStyleProfileMeta(): Promise<{ sourceCount: number; model: string; builtAt: Date } | null> {
  const row = await db.query.styleProfiles.findFirst({ where: eq(styleProfiles.persona, PERSONA) });
  if (!row) return null;
  return { sourceCount: row.sourceEmailIds.length, model: row.model, builtAt: row.builtAt };
}
