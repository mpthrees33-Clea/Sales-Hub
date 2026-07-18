/**
 * Mission Control dashboard queries (WO-02). Server-only: imported by the
 * dashboard RSCs and the /api/runs handlers, never by client code.
 *
 * All time math is anchored on getDemoNow() in the rep's timezone — never
 * `new Date()` — so Simulate Overnight and the jump-clock shift every window
 * (WO-02 acceptance). Money stays integer cents; formatting lives in the UI.
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { addDays } from "date-fns";
import { db } from "@/db/client";
import {
  accounts,
  activities,
  agentRuns,
  agentSteps,
  approvals,
  invoices,
  morningBriefs,
  opportunities,
  salesOrders,
  targets,
} from "@/db/schema";
import { getCalendarProvider } from "@/providers";
import { getDemoNow } from "@/lib/demo-clock";
import { dayBounds, inRepTz, monthBounds, weekBounds } from "@/lib/dates";
import type { StepRow } from "@/components/run-trace";

// ── KPIs ─────────────────────────────────────────────────────────────────────

export type Kpi = {
  valueCents: number;
  targetCents: number;
  /** Signed percent of value vs the matching target row. */
  deltaPct: number;
  /** Eight trailing completed weeks of this metric (oldest → newest). */
  spark: number[];
};

export type DashboardKpis = { createdWk: Kpi; createdMo: Kpi; invoicedWk: Kpi; invoicedMo: Kpi };

const SPARK_WEEKS = 8;

/** Start-of-week UTC instants for the `n` weeks preceding the week of `now`. */
function precedingWeekStarts(now: Date, n: number): Date[] {
  const starts: Date[] = [];
  for (let i = n; i >= 1; i--) {
    starts.push(weekBounds(addDays(inRepTz(now), -7 * i)).start);
  }
  return starts;
}

async function sumInRange(
  table: "sales_orders" | "invoices",
  start: Date,
  end: Date,
): Promise<number> {
  if (table === "sales_orders") {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${salesOrders.totalCents}), 0)::int` })
      .from(salesOrders)
      .where(and(gte(salesOrders.createdAt, start), lte(salesOrders.createdAt, end)));
    return row?.total ?? 0;
  }
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${invoices.amountCents}), 0)::int` })
    .from(invoices)
    .where(and(gte(invoices.issuedAt, start), lte(invoices.issuedAt, end)));
  return row?.total ?? 0;
}

/** Eight trailing weekly sums (oldest → newest) for the sparkline. */
async function weeklySpark(table: "sales_orders" | "invoices", now: Date): Promise<number[]> {
  const starts = precedingWeekStarts(now, SPARK_WEEKS);
  const out: number[] = [];
  for (const start of starts) {
    const end = new Date(addDays(start, 7).getTime() - 1);
    out.push(await sumInRange(table, start, end));
  }
  return out;
}

async function targetCents(period: "week" | "month", metric: "created" | "invoiced"): Promise<number> {
  const [row] = await db
    .select({ v: targets.valueCents })
    .from(targets)
    .where(and(eq(targets.period, period), eq(targets.metric, metric)))
    .limit(1);
  return row?.v ?? 0;
}

function deltaPct(valueCents: number, targetCents: number): number {
  if (targetCents <= 0) return 0;
  return Math.round(((valueCents - targetCents) / targetCents) * 100);
}

export async function kpis(): Promise<DashboardKpis> {
  const now = await getDemoNow();
  const wk = weekBounds(now);
  const mo = monthBounds(now);

  const [
    createdWkVal,
    createdMoVal,
    invoicedWkVal,
    invoicedMoVal,
    createdSpark,
    invoicedSpark,
    tCreatedWk,
    tCreatedMo,
    tInvoicedWk,
    tInvoicedMo,
  ] = await Promise.all([
    sumInRange("sales_orders", wk.start, wk.end),
    sumInRange("sales_orders", mo.start, mo.end),
    sumInRange("invoices", wk.start, wk.end),
    sumInRange("invoices", mo.start, mo.end),
    weeklySpark("sales_orders", now),
    weeklySpark("invoices", now),
    targetCents("week", "created"),
    targetCents("month", "created"),
    targetCents("week", "invoiced"),
    targetCents("month", "invoiced"),
  ]);

  return {
    createdWk: { valueCents: createdWkVal, targetCents: tCreatedWk, deltaPct: deltaPct(createdWkVal, tCreatedWk), spark: createdSpark },
    createdMo: { valueCents: createdMoVal, targetCents: tCreatedMo, deltaPct: deltaPct(createdMoVal, tCreatedMo), spark: createdSpark },
    invoicedWk: { valueCents: invoicedWkVal, targetCents: tInvoicedWk, deltaPct: deltaPct(invoicedWkVal, tInvoicedWk), spark: invoicedSpark },
    invoicedMo: { valueCents: invoicedMoVal, targetCents: tInvoicedMo, deltaPct: deltaPct(invoicedMoVal, tInvoicedMo), spark: invoicedSpark },
  };
}

// ── Overnight banner ─────────────────────────────────────────────────────────

export type OvernightSummary = {
  runId: string;
  triaged: number;
  drafts: number;
  /** Live count of pending approvals (not the frozen brief figure). */
  approvalsPending: number;
  elapsedMs: number;
  finishedAt: Date | null;
};

export async function overnightSummary(): Promise<OvernightSummary | null> {
  const [brief] = await db
    .select({
      runId: agentRuns.id,
      brief: morningBriefs.brief,
      finishedAt: agentRuns.finishedAt,
    })
    .from(morningBriefs)
    .innerJoin(agentRuns, eq(agentRuns.id, morningBriefs.runId))
    .where(and(eq(agentRuns.trigger, "nightly"), eq(agentRuns.agentName, "morning-brief")))
    .orderBy(desc(agentRuns.startedAt))
    .limit(1);
  if (!brief) return null;

  const counts = (brief.brief.counts ?? {}) as Record<string, number>;
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(approvals)
    .where(eq(approvals.status, "pending"));

  return {
    runId: brief.runId,
    triaged: counts.triaged ?? 0,
    drafts: counts.drafts ?? 0,
    approvalsPending: pending?.n ?? 0,
    elapsedMs: (brief.brief.elapsedMs as number | undefined) ?? 0,
    finishedAt: brief.finishedAt,
  };
}

// ── Today's docket ───────────────────────────────────────────────────────────

export type DocketItem = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  title: string;
  accountName: string | null;
  location: string | null;
  prepNotes: string | null;
  /** Populated by WO-12 via MapsProvider; placeholder until then. */
  leaveBy?: Date;
  isNext: boolean;
};

export async function todaysDocket(): Promise<DocketItem[]> {
  const now = await getDemoNow();
  const day = dayBounds(now);
  // Provider seam is the point — never read `meetings` directly here.
  const events = await getCalendarProvider().listEvents({ start: day.start, end: day.end });

  const acctIds = [...new Set(events.map((e) => e.accountId).filter((v): v is string => !!v))];
  const acctRows = acctIds.length
    ? await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, acctIds))
    : [];
  const nameById = new Map(acctRows.map((a) => [a.id, a.name]));

  // The next upcoming meeting relative to demo-now (first that hasn't started).
  const upcoming = events.filter((e) => e.startsAt.getTime() >= now.getTime());
  const nextId = upcoming[0]?.id ?? null;

  return events.map((e) => ({
    id: e.id,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    title: e.title,
    accountName: e.accountId ? (nameById.get(e.accountId) ?? null) : null,
    location: e.location,
    prepNotes: e.prepNotes,
    isNext: e.id === nextId,
  }));
}

// ── Overnight changes feed ───────────────────────────────────────────────────

export type FieldDiff = { field: string; old: unknown; new: unknown };
export type AccountChange = {
  accountId: string;
  accountName: string;
  items: {
    id: string;
    summary: string;
    opportunityName: string | null;
    diffs: FieldDiff[];
    isNew: boolean;
    occurredAt: Date;
  }[];
};

/**
 * Per-account opportunity deltas the agents produced overnight — activities in
 * the window carrying `detail.diffs`. The default seed has none (empty state);
 * `--with-overnight` seeds two. Window spans demo-yesterday through demo-now so
 * the early-morning nightly-run deltas are included.
 */
export async function overnightChanges(): Promise<AccountChange[]> {
  const now = await getDemoNow();
  const yesterday = dayBounds(addDays(inRepTz(now), -1));

  const rows = await db
    .select({
      id: activities.id,
      accountId: activities.accountId,
      accountName: accounts.name,
      opportunityName: opportunities.name,
      summary: activities.summary,
      detail: activities.detail,
      occurredAt: activities.occurredAt,
    })
    .from(activities)
    .innerJoin(accounts, eq(accounts.id, activities.accountId))
    .leftJoin(opportunities, eq(opportunities.id, activities.opportunityId))
    .where(
      and(
        gte(activities.occurredAt, yesterday.start),
        lte(activities.occurredAt, now),
        sql`${activities.detail} ? 'diffs'`,
      ),
    )
    .orderBy(desc(activities.occurredAt));

  const byAccount = new Map<string, AccountChange>();
  for (const r of rows) {
    if (!r.accountId) continue;
    const detail = (r.detail ?? {}) as { diffs?: FieldDiff[]; isNew?: boolean };
    const group = byAccount.get(r.accountId) ?? { accountId: r.accountId, accountName: r.accountName, items: [] };
    group.items.push({
      id: r.id,
      summary: r.summary,
      opportunityName: r.opportunityName ?? null,
      diffs: detail.diffs ?? [],
      isNew: detail.isNew === true,
      occurredAt: r.occurredAt,
    });
    byAccount.set(r.accountId, group);
  }
  return [...byAccount.values()];
}

// ── Agent runs + traces ──────────────────────────────────────────────────────

export type RunRow = {
  id: string;
  agentName: string;
  trigger: "nightly" | "user" | "workflow" | "system";
  status: "running" | "succeeded" | "escalated" | "failed";
  model: string | null;
  costUsd: string;
  startedAt: Date;
  finishedAt: Date | null;
  elapsedMs: number;
};

export async function recentRuns(limit: number): Promise<RunRow[]> {
  const now = await getDemoNow();
  const rows = await db
    .select({
      id: agentRuns.id,
      agentName: agentRuns.agentName,
      trigger: agentRuns.trigger,
      status: agentRuns.status,
      model: agentRuns.model,
      costUsd: agentRuns.costUsd,
      startedAt: agentRuns.startedAt,
      finishedAt: agentRuns.finishedAt,
    })
    .from(agentRuns)
    .orderBy(desc(agentRuns.startedAt))
    .limit(Math.min(50, Math.max(1, limit)));

  return rows.map((r) => ({
    ...r,
    // Finished runs use recorded wall-time; a still-running run measures against
    // the demo clock so elapsed stays meaningful under Simulate Overnight.
    elapsedMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : now.getTime() - r.startedAt.getTime(),
  }));
}

export async function runTrace(runId: string): Promise<StepRow[]> {
  const rows = await db
    .select({
      id: agentSteps.id,
      seq: agentSteps.seq,
      kind: agentSteps.kind,
      name: agentSteps.name,
      input: agentSteps.input,
      output: agentSteps.output,
      durationMs: agentSteps.durationMs,
    })
    .from(agentSteps)
    .where(eq(agentSteps.runId, runId))
    .orderBy(agentSteps.seq);
  return rows as StepRow[];
}

export async function runMeta(runId: string): Promise<RunRow | null> {
  const now = await getDemoNow();
  const [r] = await db
    .select({
      id: agentRuns.id,
      agentName: agentRuns.agentName,
      trigger: agentRuns.trigger,
      status: agentRuns.status,
      model: agentRuns.model,
      costUsd: agentRuns.costUsd,
      startedAt: agentRuns.startedAt,
      finishedAt: agentRuns.finishedAt,
    })
    .from(agentRuns)
    .where(eq(agentRuns.id, runId))
    .limit(1);
  if (!r) return null;
  return {
    ...r,
    elapsedMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : now.getTime() - r.startedAt.getTime(),
  };
}
