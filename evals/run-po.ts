/**
 * PO-extraction eval runner: runs the REAL po-intake agent over the golden
 * PDFs and scores field-level accuracy — expected nulls counted, so an
 * invented value for an absent fact shows up as `fabricated`.
 *
 *   pnpm eval:po
 *
 * Ground truth is the seed-time extraction JSON generated from the exact
 * pdf-lib draw positions. In demo mode the agent returns that same fixture
 * (by design), so demo runs score 100% and only prove the harness; live runs
 * (AI_GATEWAY_API_KEY) measure the model.
 */
import "@/lib/load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { poIntakeAgent } from "@/agents/po-intake";
import { closeDb } from "@/db/client";
import { DEMO_MODEL_ID, MODELS } from "@/lib/ai/models";
import { getBlobBuffer } from "@/lib/blob";
import { usingDemoModel } from "@/lib/env";
import { scorePoExtraction, type PoScore } from "./lib/score";

type GoldenCase = { id: string; pdfBlobUrl: string; expectedBlobUrl: string; note?: string };

async function main() {
  const goldenPath = path.join(import.meta.dirname, "golden", "po-extraction.json");
  const golden = JSON.parse(await fs.readFile(goldenPath, "utf8")) as { cases: GoldenCase[] };

  const cases: ({ id: string; status: string } & Partial<PoScore>)[] = [];
  for (const c of golden.cases) {
    const expected = JSON.parse((await getBlobBuffer(c.expectedBlobUrl)).toString("utf8")) as Record<string, unknown>;
    const run = await poIntakeAgent.run({ blobUrl: c.pdfBlobUrl }, { trigger: "user" });
    if (run.status !== "succeeded" || !run.output) {
      cases.push({ id: c.id, status: run.status });
      process.stdout.write(`  ${c.id}: ${run.status} (${run.escalation?.reason ?? "no output"})\n`);
      continue;
    }
    const score = scorePoExtraction(expected, run.output as Record<string, unknown>);
    cases.push({ id: c.id, status: "succeeded", ...score });
    process.stdout.write(
      `  ${c.id}: ${(score.accuracy * 100).toFixed(1)}% fields (${score.correct}/${score.total}) · fabricated=${score.fabricated} missed=${score.missed} wrong=${score.wrong} nullsCorrect=${score.nullsCorrect}\n`,
    );
  }

  const scored = cases.filter((c): c is { id: string; status: string } & PoScore => c.status === "succeeded");
  const agg = {
    total: scored.reduce((a, c) => a + c.total, 0),
    correct: scored.reduce((a, c) => a + c.correct, 0),
    fabricated: scored.reduce((a, c) => a + c.fabricated, 0),
    missed: scored.reduce((a, c) => a + c.missed, 0),
    wrong: scored.reduce((a, c) => a + c.wrong, 0),
    nullsCorrect: scored.reduce((a, c) => a + c.nullsCorrect, 0),
  };
  const report = {
    eval: "po-intake-field-extraction",
    ranAt: new Date().toISOString(),
    model: usingDemoModel ? DEMO_MODEL_ID : MODELS.pdf,
    demoMode: usingDemoModel,
    ...(usingDemoModel
      ? { warning: "demo mode — the agent returns the checksum-matched fixture, so this scores the harness, not the model" }
      : {}),
    fieldAccuracy: agg.total ? agg.correct / agg.total : 0,
    ...agg,
    cases: cases.map(({ fields: _fields, ...rest }) => rest),
  };

  const reportsDir = path.join(import.meta.dirname, "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const out = path.join(reportsDir, `po-${report.ranAt.slice(0, 10)}.json`);
  await fs.writeFile(out, JSON.stringify(report, null, 2));

  console.log(`\nfield accuracy: ${(report.fieldAccuracy * 100).toFixed(1)}% (${agg.correct}/${agg.total}) · fabricated=${agg.fabricated}`);
  console.log(`report: ${out}`);
  await closeDb();
}

void main();
