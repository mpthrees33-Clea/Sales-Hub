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
import { agentRuns, agentSteps, approvals, emails, morningBriefs } from "@/db/schema";
import { nightlyRun } from "@/app/api/workflows/nightly";
import { GET as cronGet } from "@/app/api/cron/nightly/route";
import { dispatchTarget } from "@/lib/nightly-dispatch";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { DEMO_NOW } from "@/db/seed/scenario";
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
    expect(result.counts.drafts).toBe(7); // 2 quotes + 2 stock + 1 scheduling + 1 technical + 1 meeting follow-up
    expect(result.counts.validatedPo).toBe(1);
    expect(result.counts.escalatedPo).toBe(1);
    expect(result.counts.opportunityUpdates).toBe(3); // incl. Phase 3 __create__ + PO-received stage move
    // Sample/submittal modules may not be installed yet — visible as skips.
    for (const s of result.skipped) {
      expect(["sample", "submittal"]).toContain(s.target);
      expect(s.reason).toBe("module_not_installed");
    }

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
