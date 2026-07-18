/**
 * pnpm smoke — run the smoke agent headlessly and report what the harness
 * recorded: the run row, ordered steps, and the pending approval created by
 * the intercepted external tool (WO-01 verification).
 */
import "@/lib/load-env";
import { asc, desc, eq } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { agentSteps, approvals, contacts, emails } from "@/db/schema";
import { smokeAgent } from "@/agents/smoke";

async function main() {
  const contact = await db.select().from(contacts).orderBy(asc(contacts.email)).limit(1);
  if (!contact[0]) throw new Error("no seeded contacts — run pnpm seed first");

  const before = await db.$count(emails);
  const result = await smokeAgent.run(
    { note: "wo-01 verification", contactEmail: contact[0].email },
    { trigger: "user" },
  );

  console.log(`run id      : ${result.runId}`);
  console.log(`status      : ${result.status}`);
  console.log(`output      : ${JSON.stringify(result.output)}`);
  console.log(`approvals   : ${result.approvalIds.join(", ") || "(none)"}`);
  console.log(`evidence    : ${result.evidence.length} item(s)`);

  const steps = await db
    .select()
    .from(agentSteps)
    .where(eq(agentSteps.runId, result.runId))
    .orderBy(asc(agentSteps.seq));
  for (const s of steps) {
    console.log(`  step ${s.seq}: [${s.kind}] ${s.name} (${s.durationMs}ms)`);
  }

  const approval = await db.select().from(approvals).orderBy(desc(approvals.createdAt)).limit(1);
  const after = await db.$count(emails);
  console.log(`pending approval: ${approval[0]?.id} kind=${approval[0]?.kind} status=${approval[0]?.status}`);
  console.log(`emails before/after: ${before}/${after} ${before === after ? "(no send occurred ✓)" : "(!! SEND HAPPENED)"}`);

  if (approval[0]?.status !== "pending" || before !== after || result.status !== "succeeded") {
    process.exitCode = 1;
    console.error("SMOKE FAILED");
  } else {
    console.log("SMOKE PASSED — external effect intercepted, run fully recorded");
  }
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await closeDb();
});
