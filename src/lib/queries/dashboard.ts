/**
 * Mission Control query module (WO-02). Server-only. Every time window is
 * anchored on getDemoNow() in the rep's TZ — no `new Date()` anywhere in
 * dashboard code. The docket reads through CalendarProvider, never the
 * meetings table (the provider seam is the point).
 */
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accounts,
  activities,
  agentRuns,
  agentSteps,
  approvals,
  invoices,
  morningBriefs,
  salesOrders,
  targets,
} from "@/db/schema";
import { dayBounds, monthBounds, weekBounds, yesterdayBounds } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { getCalendarProvider } from "@/providers";
import type { CalendarEvent } from "@/providers/calendar/types";

export type Kpi = { valueCents: number; targetCents: number; deltaPct: number; spark: number[] };

export async function kpis(): Promise<{ createdWk: Kpi; createdMo: Kpi; invoicedWk: Kpi; invoicedMo: Kpi }> {
  const demoNow = await getDemoNow();
  const wk = weekBounds(demoNow);
  const mo = monthBounds(demoNow);

  const targetRows = await db.select().from(targets);
  const target = (period: "week" | "month", metric: "created" | "invoiced") =>
    targetRows.find((t) => t.period === period && t.metric === metric)?.valueCents ?? 0;

  const sumOrders = async (start: Date, end: Date) => {
    const [row] = await db
      .select({ total: sql<string>`coalesce(sum(${salesOrders.totalCents}), 0)` })
      .from(salesOrders)
      .where(and(gte(salesOrders.createdAt, start), lte(salesOrders.createdAt, end)));
    return Number(row?.total ?? 0);
  };
  const sumInvoices = async (start: Date, end: Date) => {
    const [row] = await db
      .select({ total: sql<string>`coalesce(sum(${invoices.amountCents}), 0)` })
      .from(invoices)
      .where(and(gte(invoices.issuedAt, start), lte(invoices.issuedAt, end)));
    return Number(row?.total ?? 0);
  };

  // 8-week sparkline: weekly sums for the 8 weeks ending at the current week.
  const sparkFor = async (kind: "created" | "invoiced") => {
    const points: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const anchor = new Date(demoNow.getTime() - i * 7 * 86_400_000);
      const b = weekBounds(anchor);
      points.push(kind === "created" ? await sumOrders(b.start, b.end) : await sumInvoices(b.start, b.end));
    }
    return points;
  };

  const [createdWkV, createdMoV, invoicedWkV, invoicedMoV, sparkCreated, sparkInvoiced] = await Promise.all([
    sumOrders(wk.start, wk.end),
    sumOrders(mo.start, mo.end),
    sumInvoices(wk.start, wk.end),
    sumInvoices(mo.start, mo.end),
    sparkFor("created"),
    sparkFor("invoiced"),
  ]);

  const mk = (valueCents: number, targetCents: number, spark: number[]): Kpi => ({
    valueCents,
    targetCents,
    deltaPct: targetCents > 0 ? ((valueCents - targetCents) / targetCents) * 100 : 0,
    spark,
  });

  return {
    createdWk: mk(createdWkV, target("week", "created"), sparkCreated),
    createdMo: mk(createdMoV, target("month", "created"), sparkCreated),
    invoicedWk: mk(invoicedWkV, target("week", "invoiced"), sparkInvoiced),
    invoicedMo: mk(invoicedMoV, target("month", "invoiced"), sparkInvoiced),
  };
}

export type OvernightSummary = {
  runId: string;
  narrative: string | null;
  triaged: number;
  archived: number;
  drafts: number;
  approvalsPending: number;
  elapsedMs: number;
  finishedAt: Date;
};

export async function overnightSummary(): Promise<OvernightSummary | null> {
  const brief = await db
    .select()
    .from(morningBriefs)
    .orderBy(desc(morningBriefs.createdAt))
    .limit(1);
  const [pending] = await db.select({ n: count() }).from(approvals).where(eq(approvals.status, "pending"));
  if (brief[0]) {
    const b = brief[0];
    const counts = (b.brief as { counts?: Record<string, number> }).counts ?? {};
    const run = b.runId
      ? await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, b.runId) })
      : undefined;
    return {
      runId: b.runId ?? "",
      narrative: b.narrative,
      triaged: counts.triaged ?? 0,
      archived: counts.archived ?? 0,
      drafts: counts.drafts ?? 0,
      approvalsPending: pending?.n ?? 0,
      elapsedMs: (b.brief as { elapsedMs?: number }).elapsedMs ?? 0,
      finishedAt: run?.finishedAt ?? b.createdAt,
    };
  }
  return null;
}

export type DocketItem = CalendarEvent & { isNext: boolean };

export async function todaysDocket(): Promise<DocketItem[]> {
  const demoNow = await getDemoNow();
  const { start, end } = dayBounds(demoNow);
  const events = await getCalendarProvider().listEvents({ start, end });
  const nextIdx = events.findIndex((e) => e.endsAt.getTime() >= demoNow.getTime());
  return events.map((e, i) => ({ ...e, isNext: i === nextIdx }));
}

export type AccountDelta = {
  accountId: string;
  accountName: string;
  items: {
    id: string;
    type: string;
    summary: string;
    occurredAt: Date;
    diffs: { field: string; old: unknown; new: unknown }[];
    isNew: boolean;
  }[];
};

/**
 * Per-account deltas for demo-yesterday. Window runs from yesterday 00:00 to
 * demo-now so overnight-run writes (which land early "today" about
 * yesterday's activity) group in.
 */
export async function overnightChanges(): Promise<AccountDelta[]> {
  const demoNow = await getDemoNow();
  const { start } = yesterdayBounds(demoNow);
  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      summary: activities.summary,
      detail: activities.detail,
      occurredAt: activities.occurredAt,
      accountId: activities.accountId,
      accountName: accounts.name,
    })
    .from(activities)
    .innerJoin(accounts, eq(accounts.id, activities.accountId))
    .where(and(gte(activities.occurredAt, start), lte(activities.occurredAt, demoNow)))
    .orderBy(desc(activities.occurredAt));

  const byAccount = new Map<string, AccountDelta>();
  for (const r of rows) {
    if (!r.accountId) continue;
    const entry = byAccount.get(r.accountId) ?? { accountId: r.accountId, accountName: r.accountName, items: [] };
    const detail = (r.detail ?? {}) as { diffs?: { field: string; old: unknown; new: unknown }[] };
    const diffs = detail.diffs ?? [];
    entry.items.push({
      id: r.id,
      type: r.type,
      summary: r.summary,
      occurredAt: r.occurredAt,
      diffs,
      isNew: diffs.some((d) => d.field === "__create__"),
    });
    byAccount.set(r.accountId, entry);
  }
  return [...byAccount.values()];
}

export type RunRow = {
  id: string;
  agentName: string;
  trigger: string;
  status: "running" | "succeeded" | "escalated" | "failed";
  model: string | null;
  costUsd: string;
  startedAt: Date;
  finishedAt: Date | null;
};

export async function recentRuns(limit: number): Promise<RunRow[]> {
  return db
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
    .limit(limit);
}

export async function runTrace(runId: string) {
  const run = await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, runId) });
  if (!run) return null;
  const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, runId)).orderBy(asc(agentSteps.seq));
  return { run, steps };
}
