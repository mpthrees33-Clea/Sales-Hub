/**
 * Central AI Gateway model ids (docs/01-ARCHITECTURE.md §1). No module ever
 * hardcodes a model string — import MODELS. Strings are Vercel AI Gateway
 * ids (creator/model), resolved by the AI SDK's gateway provider.
 */
export const MODELS = {
  /** Triage / classification — cheap, high volume, metadata-first. */
  fast: "anthropic/claude-haiku-4.5",
  /** Drafting, extraction, summarization, agents generally. */
  frontier: "anthropic/claude-sonnet-4.5",
  /** PO extraction with native PDF input (page-grounded citations). */
  pdf: "anthropic/claude-sonnet-4.5",
  /** Room scenes — reference-conditioned photoreal interiors. */
  image: "google/gemini-3-pro-image",
  /** Optional morning-brief TTS (stretch). */
  tts: "openai/gpt-4o-mini-tts",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/**
 * Demo-mode stand-in id recorded on agent_runs when no AI_GATEWAY_API_KEY is
 * configured and the deterministic demo model runs instead of a live LLM.
 */
export const DEMO_MODEL_ID = "clea/demo-deterministic";

/** Rough $/1M token pricing for run-cost display (Gateway reports real usage in production). */
export const MODEL_PRICING_PER_MTOK: Record<string, { in: number; out: number }> = {
  [MODELS.fast]: { in: 1, out: 5 },
  [MODELS.frontier]: { in: 3, out: 15 },
  [DEMO_MODEL_ID]: { in: 0, out: 0 },
};
