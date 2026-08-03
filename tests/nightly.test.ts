/**
 * WO-08 acceptance: dispatch registry degrades gracefully; the workflow
 * completes green with the merged modules producing the docs/04 §3 core
 * counts; a second simulate on the same demo day is a no-op with zero new
 * approvals; the cron route rejects unauthenticated invocation; parent and
 * child runs link via workflow_run_id.
 */
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/load-env";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agentRuns, agentSteps, approvals, emails, morningBriefs, submittalPackages } from "@/db/schema";
import { nightlyRun } from "@/app/api/workflows/nightly";
import { GET as cronGet } from "@/app/api/cron/nightly/route";
import { dispatchTarget } from "@/lib/nightly-dispatch";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { DEMO_NOW } from "@/db/seed/scenario";
import { sid } from "@/db/seed/ids";
import { resetStagedBatch } from "./helpers/reset-staged";

beforeAll(async () => {
  await setDemoNow(DEMO_NOW);
  invalidateDemoClockCache();
  await resetStagedBatch();
  // Clear nightly residue so this suite exercises a fresh night.
  await db.execute(sql`delete from morning_briefs`);
  await db.execute(sql`delete from agent_steps`);
  await db.execute(sql`update sales_orders set po_id = null where po_id is not null`);
  await db.execute(sql`delete from sales_orders where number >= 'SO-2050'`);
  await db.execute(sql`delete from purchase_orders`);
  await db.execute(sql`delete from agent_runs`);
  await db.execute(sql`update demo_state set last_nightly_run_at = null where id = 1`);
  await db.execute(sql`update transcripts set summary = null, action_items = null`);
  await db.execute(
    sql`delete from opportunities where name = 'Harborview Medical Ph3 — Outpatient Wing (planning)'`,
  );
  await db.execute(sql`update opportunities set stage = 'quoted' where name like 'Piedmont%'`);
});

describe("nightly run", () => {
  it("completes green, produces the docs/04 §3 core counts, and links child runs", async () => {
    const result = await nightlyRun({ trigger: "simulate" });
    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;

    expect(result.counts.triaged).toBe(14);
    expect(result.counts.archived).toBe(3);
    expect(result.counts.drafts).toBe(9); // 2 quotes + 2 stock + 1 scheduling + 1 technical + 1 meeting follow-up + 2 sample confirmations
    expect(result.counts.validatedPo).toBe(1);
    expect(result.counts.escalatedPo).toBe(1);
    expect(result.counts.opportunityUpdates).toBe(3); // incl. Phase 3 __create__ + PO-received stage move
    expect(result.counts.samples).toBe(2); // low tier, batch-approvable
    // Every specialist module is installed now — nothing skips.
    expect(result.skipped).toEqual([]);

    // The submittal routing became a PREPARED builder session, not an
    // auto-assembled package (WO-14 task 6 — composition is human judgment).
    const prepared = await db.query.submittalPackages.findMany({ where: eq(submittalPackages.status, "draft") });
    expect(prepared).toHaveLength(1);
    expect(prepared[0]!.productIds).toHaveLength(3);
    expect(prepared[0]!.sourceEmailId).toBe(sid("email:in-submittal-whitaker"));

    // Parent run with workflow steps; children linked via workflow_run_id.
    const parent = await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, result.workflowRunId) });
    expect(parent?.agentName).toBe("nightly-run");
    expect(parent?.status).toBe("succeeded");
    const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, result.workflowRunId));
    const stepNames = steps.map((s) => s.name);
    expect(stepNames).toEqual(
      expect.arrayContaining(["syncInbox", "triageAll", "fanOut:quote", "fanOut:po_intake", "fanOut:reply", "processMeetings", "updateOpportunities", "assembleBrief"]),
    );
    const children = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(eq(agentRuns.workflowRunId, result.workflowRunId));
    expect(children[0]!.n).toBeGreaterThanOrEqual(18); // 14 triage + quotes + po + replies + meeting + opp + brief

    // Morning brief persisted.
    const brief = await db.query.morningBriefs.findFirst({ where: eq(morningBriefs.runId, result.workflowRunId) });
    expect(brief?.narrative.length).toBeGreaterThan(40);

    // Every inbound processed.
    const [unprocessed] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(emails)
      .where(and(eq(emails.direction, "inbound"), eq(emails.isProcessed, false)));
    expect(unprocessed!.n).toBe(0);
  });

  it("second simulate on the same demo day is a no-op with zero new approvals", async () => {
    const before = await db.$count(approvals);
    const result = await nightlyRun({ trigger: "simulate" });
    expect(result.status).toBe("noop");
    expect(await db.$count(approvals)).toBe(before);
  });

  it("a crashed night is ADOPTED and resumed duplicate-free (same run, no new approvals)", async () => {
    // Simulate a serverless-timeout death: parent marked failed mid-flight.
    const parent = await db.query.agentRuns.findFirst({ where: isNotNull(agentRuns.dedupKey) });
    expect(parent).toBeTruthy();
    await db.update(agentRuns).set({ status: "failed", finishedAt: null }).where(eq(agentRuns.id, parent!.id));
    await db.execute(sql`delete from morning_briefs`);

    const before = await db.$count(approvals);
    const result = await nightlyRun({ trigger: "simulate" });
    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    // Same parent run resumed — not a new one.
    expect(result.workflowRunId).toBe(parent!.id);
    // Idempotent steps: nothing re-proposed, brief re-persisted exactly once.
    expect(await db.$count(approvals)).toBe(before);
    expect(await db.$count(morningBriefs)).toBe(1);
  });

  it("dispatching a target with no pending routings reports empty (not failure)", async () => {
    const outcomes = await dispatchTarget("quote", { workflowRunId: "test" });
    expect(outcomes).toEqual([{ target: "quote", status: "empty" }]);
  });
});

describe("cron route", () => {
  it("rejects unauthenticated invocation", async () => {
    const res = await cronGet({ headers: { get: () => null } } as never);
    expect(res.status).toBe(401);
  });
});

describe("run linkage sanity", () => {
  it("all nightly-triggered child runs carry the parent workflow id", async () => {
    const orphans = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(and(eq(agentRuns.trigger, "nightly"), sql`${agentRuns.workflowRunId} is null`, sql`${agentRuns.agentName} != 'nightly-run'`));
    expect(orphans[0]!.n).toBe(0);
    const linked = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(isNotNull(agentRuns.workflowRunId));
    expect(linked[0]!.n).toBeGreaterThan(0);
  });
});
