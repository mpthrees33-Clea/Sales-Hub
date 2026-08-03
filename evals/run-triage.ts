/**
 * Triage eval runner: runs the REAL email-triage agent over the golden set
 * and scores classification accuracy + a confusion matrix.
 *
 *   pnpm eval:triage
 *
 * Live mode (AI_GATEWAY_API_KEY set) measures the model. Demo mode still runs
 * — through the same harness — but scores the deterministic heuristics, so
 * the report is stamped with the model id and a demo flag; treat demo runs as
 * harness smoke, not a model eval.
 */
import "@/lib/load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { emailTriageAgent } from "@/agents/email-triage";
import { closeDb, db } from "@/db/client";
import { emails, emailThreads } from "@/db/schema";
import { sid } from "@/db/seed/ids";
import { DEMO_MODEL_ID, MODELS } from "@/lib/ai/models";
import { usingDemoModel } from "@/lib/env";
import { scoreTriage, type TriageCaseResult } from "./lib/score";

type GoldenCase = {
  id: string;
  source: "seed" | "inline";
  fixtureKey?: string;
  expected: string;
  note?: string;
  email?: {
    fromEmail: string;
    subject: string;
    bodyText: string;
    attachments?: { name: string; contentType: string; blobKey: string; sizeBytes: number }[];
  };
};

async function main() {
  const goldenPath = path.join(import.meta.dirname, "golden", "triage.json");
  const golden = JSON.parse(await fs.readFile(goldenPath, "utf8")) as { cases: GoldenCase[] };

  const results: TriageCaseResult[] = [];
  const cleanup: { emailId: string; threadId: string }[] = [];

  for (const c of golden.cases) {
    let emailId: string;
    if (c.source === "seed") {
      emailId = sid(`email:${c.fixtureKey}`);
      const exists = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
      if (!exists) throw new Error(`seeded email ${c.fixtureKey} not found — run pnpm seed first`);
    } else {
      // Inline adversarial case: insert a throwaway thread + email.
      const receivedAt = new Date("2026-01-05T09:00:00Z");
      const [thread] = await db
        .insert(emailThreads)
        .values({
          subject: c.email!.subject,
          participants: [c.email!.fromEmail, "cole.mercer@meridiansurfaces.example.com"],
          lastMessageAt: receivedAt,
          status: "active",
        })
        .returning({ id: emailThreads.id });
      const [row] = await db
        .insert(emails)
        .values({
          threadId: thread!.id,
          direction: "inbound",
          fromEmail: c.email!.fromEmail,
          toEmails: ["cole.mercer@meridiansurfaces.example.com"],
          subject: c.email!.subject,
          bodyText: c.email!.bodyText,
          receivedAt,
          attachments: c.email!.attachments ?? [],
        })
        .returning({ id: emails.id });
      emailId = row!.id;
      cleanup.push({ emailId, threadId: thread!.id });
    }

    try {
      const run = await emailTriageAgent.run({ emailId }, { trigger: "user" });
      results.push({
        id: c.id,
        expected: c.expected,
        predicted: run.status === "succeeded" && run.output ? run.output.category : null,
      });
      process.stdout.write(`  ${c.id}: expected=${c.expected} predicted=${results.at(-1)!.predicted}\n`);
    } catch (err) {
      results.push({ id: c.id, expected: c.expected, predicted: null });
      process.stdout.write(`  ${c.id}: run failed (${err instanceof Error ? err.message : err})\n`);
    }
  }

  for (const { emailId, threadId } of cleanup) {
    await db.delete(emails).where(eq(emails.id, emailId));
    await db.delete(emailThreads).where(eq(emailThreads.id, threadId));
  }

  const score = scoreTriage(results);
  const report = {
    eval: "email-triage-classification",
    ranAt: new Date().toISOString(),
    model: usingDemoModel ? DEMO_MODEL_ID : MODELS.fast,
    demoMode: usingDemoModel,
    ...(usingDemoModel ? { warning: "demo mode — scores the deterministic heuristics through the same harness; not a model eval" } : {}),
    ...score,
    fieldsNote: "confusion[expected][predicted]; predicted ∅ = run escalated/failed",
  };

  const reportsDir = path.join(import.meta.dirname, "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const out = path.join(reportsDir, `triage-${report.ranAt.slice(0, 10)}.json`);
  await fs.writeFile(out, JSON.stringify(report, null, 2));

  console.log(`\naccuracy: ${(score.accuracy * 100).toFixed(1)}% (${score.correct}/${score.total})`);
  if (score.failures.length) console.log("failures:", score.failures);
  console.log(`report: ${out}`);
  await closeDb();
}

void main();
