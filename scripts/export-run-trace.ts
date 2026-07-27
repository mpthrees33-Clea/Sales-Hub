/**
 * Export one complete nightly workflow run as sanitized JSON for the
 * clea-solutions.ai case-study exhibit ("show the loop, not just the
 * screens"): parent workflow steps, every child agent run with its tool
 * calls, the effect:'external' interception moments, tokens and cost.
 *
 *   pnpm tsx scripts/export-run-trace.ts [outPath]
 *
 * Runs film-day reset → nightly (demo mode is byte-deterministic, so the
 * exported trace is reproducible). Data is fictional demo content by
 * construction; sanitization here means truncating step payloads to
 * summaries, not scrubbing secrets (there are none in demo data).
 */
import "@/lib/load-env";
import fs from "node:fs/promises";
import { asc, eq } from "drizzle-orm";
import { nightlyRun } from "@/app/api/workflows/nightly";
import { closeDb, db } from "@/db/client";
import { agentRuns, agentSteps } from "@/db/schema";
import { runSeed } from "@/db/seed";

const summarize = (v: unknown, max = 400): unknown => {
  if (v == null) return null;
  const s = JSON.stringify(v);
  return s.length <= max ? v : { _truncated: true, preview: `${s.slice(0, max)}…` };
};

async function main() {
  const outPath = process.argv[2] ?? "var/run-trace.json";

  console.log("film-day reset…");
  const seedRes = await runSeed({ resetDay: true });
  if (!seedRes.ok) throw new Error("seed consistency check failed");

  console.log("nightly run…");
  const nightly = await nightlyRun({ trigger: "simulate" });
  if (nightly.status !== "completed") throw new Error(`nightly did not complete: ${JSON.stringify(nightly)}`);

  const parent = await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, nightly.workflowRunId) });
  const parentSteps = await db
    .select()
    .from(agentSteps)
    .where(eq(agentSteps.runId, nightly.workflowRunId))
    .orderBy(asc(agentSteps.seq));
  const children = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.workflowRunId, nightly.workflowRunId))
    .orderBy(asc(agentRuns.createdAt));

  const trace = {
    exportedFor: "clea-solutions.ai /sales-hub case study — deterministic demo-mode nightly run",
    generatedBy: "scripts/export-run-trace.ts (re-runnable; demo mode is byte-deterministic)",
    workflow: {
      runId: parent!.id,
      agentName: parent!.agentName,
      model: parent!.model,
      status: parent!.status,
      counts: nightly.counts,
      elapsedMs: nightly.elapsedMs,
      steps: parentSteps.map((s) => ({
        seq: s.seq,
        kind: s.kind,
        name: s.name,
        output: summarize(s.output),
        durationMs: s.durationMs,
      })),
    },
    childRuns: await Promise.all(
      children.map(async (r) => {
        const steps = await db
          .select()
          .from(agentSteps)
          .where(eq(agentSteps.runId, r.id))
          .orderBy(asc(agentSteps.seq));
        return {
          runId: r.id,
          agentName: r.agentName,
          model: r.model,
          status: r.status,
          tokensIn: r.tokensIn,
          tokensOut: r.tokensOut,
          costUsd: r.costUsd,
          steps: steps.map((s) => {
            const out = s.output as Record<string, unknown> | null;
            const intercepted = s.kind === "tool_call" && out != null && out.queued === true;
            return {
              seq: s.seq,
              kind: s.kind,
              name: s.name,
              // The money moment: an external-effect tool call that did NOT
              // execute — it became a pending approval row instead.
              ...(intercepted ? { intercepted: true, approvalId: out.approvalId } : {}),
              input: summarize(s.input, 240),
              output: summarize(s.output, 240),
              durationMs: s.durationMs,
            };
          }),
        };
      }),
    ),
  };

  await fs.writeFile(outPath, JSON.stringify(trace, null, 2));
  const interceptions = trace.childRuns.flatMap((r) => r.steps.filter((s) => "intercepted" in s && s.intercepted));
  console.log(
    `wrote ${outPath} — ${trace.childRuns.length} child runs, ${interceptions.length} intercepted external calls`,
  );
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await closeDb();
});
