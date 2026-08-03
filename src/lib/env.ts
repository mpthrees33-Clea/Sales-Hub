/**
 * Zod-parsed environment — fail fast at import (docs/01-ARCHITECTURE.md §7).
 * Secrets never use NEXT_PUBLIC_. `.env.example` documents every var here.
 */
import { z } from "zod";

const boolString = z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true");

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Empty ⇒ the harness runs the deterministic demo model (no live LLM calls). */
  AI_GATEWAY_API_KEY: z.string().default(""),
  /**
   * Direct Anthropic API key — enables the Message Batches path for the
   * nightly triage sweep (50% token cost). Empty ⇒ serial gateway calls.
   */
  ANTHROPIC_API_KEY: z.string().default(""),
  /** Empty ⇒ blobs stored on local filesystem under var/blob, served at /api/blob. */
  BLOB_READ_WRITE_TOKEN: z.string().default(""),
  DEMO_MODE: boolString,
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  DEMO_LOGIN_PASSWORD: z.string().min(1),
  ASSEMBLYAI_API_KEY: z.string().default(""),
  GOOGLE_MAPS_API_KEY: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  SCENES_LIVE_IN_DEMO: boolString,
  CRON_SECRET: z.string().default(""),
  MS_GRAPH_CLIENT_ID: z.string().default(""),
  MS_GRAPH_CLIENT_SECRET: z.string().default(""),
  MS_GRAPH_TENANT_ID: z.string().default(""),
});

export const env = schema.parse(process.env);

/** True when agent runs use the deterministic scripted demo model instead of live LLM calls. */
export const usingDemoModel = env.AI_GATEWAY_API_KEY === "";
/** True when blobs live on the local filesystem instead of Vercel Blob. */
export const usingLocalBlobStore = env.BLOB_READ_WRITE_TOKEN === "";
