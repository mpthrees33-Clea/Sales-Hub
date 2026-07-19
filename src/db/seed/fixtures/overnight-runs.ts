/**
 * `pnpm seed --with-overnight` (WO-02 task 11, dev-only): one synthetic
 * morning-brief nightly run whose summary matches docs/04 §3 counts, plus a
 * few finished runs with plausible ordered steps, so the dashboard banner,
 * runs panel, ticker, and changes feed are demonstrable before WO-08 runs
 * for real. Never part of the default seed.
 */
import { db } from "@/db/client";
import { activities, agentRuns, agentSteps, morningBriefs, opportunities } from "@/db/schema";
import { DEMO_NOW, et } from "../scenario";
import { sid } from "../ids";

export async function seedOvernightFixtures(): Promise<void> {
  const nightStart = et("2026-03-10T05:00");

  const runs: { key: string; agent: string; steps: { kind: "llm_call" | "tool_call" | "validation"; name: string; ms: number }[]; status?: "succeeded" | "escalated" }[] = [
    {
      key: "fix-run-triage",
      agent: "email-triage",
      steps: [
        { kind: "tool_call", name: "lookup_sender", ms: 120 },
        { kind: "llm_call", name: "classify", ms: 840 },
      ],
    },
    {
      key: "fix-run-quote",
      agent: "quote",
      steps: [
        { kind: "tool_call", name: "lookup_products", ms: 160 },
        { kind: "tool_call", name: "check_stock", ms: 90 },
        { kind: "tool_call", name: "get_pricing", ms: 110 },
        { kind: "tool_call", name: "create_email_draft", ms: 70 },
        { kind: "llm_call", name: "draft", ms: 2100 },
      ],
    },
    {
      key: "fix-run-po",
      agent: "po-intake",
      steps: [
        { kind: "llm_call", name: "extract_pdf", ms: 6200 },
        { kind: "validation", name: "schema_complete", ms: 12 },
        { kind: "validation", name: "sku_resolution", ms: 40 },
        { kind: "validation", name: "price_match", ms: 35 },
        { kind: "validation", name: "qty_uom_sanity", ms: 8 },
        { kind: "validation", name: "customer_shipto_match", ms: 22 },
        { kind: "validation", name: "credit_terms", ms: 18 },
        { kind: "validation", name: "duplicate_detection", ms: 25 },
      ],
    },
    {
      key: "fix-run-opp",
      agent: "opportunity-update",
      steps: [
        { kind: "tool_call", name: "get_account_context", ms: 130 },
        { kind: "llm_call", name: "propose_updates", ms: 1900 },
        { kind: "tool_call", name: "propose_opportunity_update", ms: 60 },
      ],
    },
  ];

  let offset = 0;
  for (const r of runs) {
    const startedAt = new Date(nightStart.getTime() + offset * 60_000);
    const total = r.steps.reduce((a, s) => a + s.ms, 0);
    await db.insert(agentRuns).values({
      id: sid(`fixture:${r.key}`),
      agentName: r.agent,
      trigger: "nightly",
      input: { fixture: true },
      output: { fixture: true },
      status: r.status ?? "succeeded",
      model: "clea/demo-deterministic",
      tokensIn: 1200,
      tokensOut: 380,
      costUsd: "0.004100",
      startedAt,
      finishedAt: new Date(startedAt.getTime() + total),
      workflowRunId: "fixture-overnight",
    });
    await db.insert(agentSteps).values(
      r.steps.map((s, i) => ({
        id: sid(`fixture:${r.key}:step:${i}`),
        runId: sid(`fixture:${r.key}`),
        seq: i + 1,
        kind: s.kind,
        name: s.name,
        input: null,
        output: s.kind === "validation" ? { pass: true } : null,
        durationMs: s.ms,
      })),
    );
    offset += 2;
  }

  // Morning-brief parent run + brief matching docs/04 §3 counts.
  const briefStart = et("2026-03-10T05:22");
  await db.insert(agentRuns).values({
    id: sid("fixture:fix-run-brief"),
    agentName: "morning-brief",
    trigger: "nightly",
    input: { fixture: true },
    output: { fixture: true },
    status: "succeeded",
    model: "clea/demo-deterministic",
    tokensIn: 900,
    tokensOut: 160,
    costUsd: "0.001700",
    startedAt: briefStart,
    finishedAt: new Date(briefStart.getTime() + 4200),
    workflowRunId: "fixture-overnight",
  });
  await db.insert(morningBriefs).values({
    id: sid("fixture:brief"),
    runId: sid("fixture:fix-run-brief"),
    briefDate: "2026-03-10",
    narrative:
      "Overnight the agents triaged 14 emails (3 archived as noise), drafted 6 replies including two quotes, validated one PO into a draft sales order, and escalated one PO on a price mismatch. Nine approvals are waiting — the queue clears in about ten minutes.",
    brief: {
      counts: { triaged: 14, archived: 3, drafts: 6, approvalsPending: 9, validatedPo: 1, escalatedPo: 1 },
      elapsedMs: 22 * 60_000 + 4200,
    },
  });

  // Overnight per-account deltas for the changes feed.
  const deltas = [
    {
      key: "fix-delta-whitaker",
      accountKey: "gc-whitaker",
      oppKey: "opp-harborview2",
      summary: "Stage moved after Monday site walk",
      detail: { diffs: [{ field: "next_step", old: "Walk-through with Ray; send Walnut Grain pricing + PDS docs", new: "Send walnut pricing + PDS/install docs to Ray and Jenna" }] },
    },
    {
      key: "fix-delta-piedmont",
      accountKey: "di-piedmont",
      oppKey: "opp-piedmont-q1042",
      summary: "PO received against Q-1042 (escalated at price match)",
      detail: { diffs: [{ field: "stage", old: "quoted", new: "po_received" }] },
    },
  ];
  for (const d of deltas) {
    await db.insert(activities).values({
      id: sid(`fixture:${d.key}`),
      type: "note",
      accountId: sid(`account:${d.accountKey}`),
      opportunityId: sid(`opportunity:${d.oppKey}`),
      refType: "agent_run",
      refId: sid("fixture:fix-run-opp"),
      summary: d.summary,
      detail: d.detail,
      occurredAt: et("2026-03-10T05:20"),
    });
  }
  void opportunities;
  void DEMO_NOW;
}
