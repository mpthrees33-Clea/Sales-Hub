/**
 * CRM query module (server-only). Accounts directory with rollups, single
 * account detail with related records, and the opportunity pipeline grouped by
 * stage. Follows the dashboard query-module convention: pure async functions,
 * demo-clock via callers (rows carry their own timestamps), integer cents.
 */
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accounts,
  activities,
  contacts,
  meetings,
  opportunities,
  projects,
  quotes,
  salesOrders,
  sampleOrders,
} from "@/db/schema";
import { STAGE_ORDER, isOpenStage, type Stage } from "@/lib/crm-stages";

type AccountType = (typeof accounts.$inferSelect)["type"];

export type AccountListRow = {
  id: string;
  name: string;
  type: string;
  tier: string;
  city: string;
  state: string;
  openCount: number;
  pipelineCents: number;
  lastActivityAt: Date | null;
};

/** Accounts with open-pipeline rollups, optionally filtered by type / search. */
export async function listAccounts(filter?: { type?: string; q?: string }): Promise<AccountListRow[]> {
  const conds = [];
  if (filter?.type && filter.type !== "all") conds.push(eq(accounts.type, filter.type as AccountType));
  if (filter?.q) conds.push(ilike(accounts.name, `%${filter.q}%`));
  const accts = await db
    .select()
    .from(accounts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(accounts.name));
  if (accts.length === 0) return [];

  const ids = accts.map((a) => a.id);
  const opps = await db
    .select({
      accountId: opportunities.accountId,
      stage: opportunities.stage,
      valueCents: opportunities.valueCents,
      lastActivityAt: opportunities.lastActivityAt,
    })
    .from(opportunities)
    .where(inArray(opportunities.accountId, ids));

  const roll = new Map<string, { openCount: number; pipelineCents: number; last: Date | null }>();
  for (const o of opps) {
    const cur = roll.get(o.accountId) ?? { openCount: 0, pipelineCents: 0, last: null };
    if (isOpenStage(o.stage as Stage)) {
      cur.openCount += 1;
      cur.pipelineCents += o.valueCents;
    }
    if (o.lastActivityAt && (!cur.last || o.lastActivityAt > cur.last)) cur.last = o.lastActivityAt;
    roll.set(o.accountId, cur);
  }

  return accts.map((a) => {
    const m = roll.get(a.id);
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      tier: a.tier,
      city: a.address.city,
      state: a.address.state,
      openCount: m?.openCount ?? 0,
      pipelineCents: m?.pipelineCents ?? 0,
      lastActivityAt: m?.last ?? null,
    };
  });
}

export type CrmSummary = { accounts: number; openOpps: number; pipelineCents: number; wonCents: number };

export async function crmSummary(): Promise<CrmSummary> {
  const [acctRows, oppRows] = await Promise.all([
    db.select({ n: sql<string>`count(*)` }).from(accounts),
    db.select({ stage: opportunities.stage, valueCents: opportunities.valueCents }).from(opportunities),
  ]);
  let openOpps = 0;
  let pipelineCents = 0;
  let wonCents = 0;
  for (const o of oppRows) {
    if (isOpenStage(o.stage as Stage)) {
      openOpps += 1;
      pipelineCents += o.valueCents;
    }
    if (o.stage === "closed_won") wonCents += o.valueCents;
  }
  return { accounts: Number(acctRows[0]?.n ?? 0), openOpps, pipelineCents, wonCents };
}

/** One account plus its related records for the detail page. Null if unknown. */
export async function accountDetail(id: string) {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  if (!account) return null;
  const [contactRows, oppRows, actRows, quoteRows, soRows, sampleRows, meetingRows, projectRows] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.accountId, id)).orderBy(asc(contacts.name)),
    db.select().from(opportunities).where(eq(opportunities.accountId, id)).orderBy(desc(opportunities.valueCents)),
    db.select().from(activities).where(eq(activities.accountId, id)).orderBy(desc(activities.occurredAt)).limit(30),
    db.select().from(quotes).where(eq(quotes.accountId, id)).orderBy(desc(quotes.createdAt)).limit(10),
    db.select().from(salesOrders).where(eq(salesOrders.accountId, id)).orderBy(desc(salesOrders.createdAt)).limit(10),
    db.select().from(sampleOrders).where(eq(sampleOrders.accountId, id)).orderBy(desc(sampleOrders.createdAt)).limit(10),
    db.select().from(meetings).where(eq(meetings.accountId, id)).orderBy(desc(meetings.startsAt)).limit(10),
    db.select().from(projects).where(eq(projects.accountId, id)).orderBy(asc(projects.name)),
  ]);
  return {
    account,
    contacts: contactRows,
    opportunities: oppRows,
    activities: actRows,
    quotes: quoteRows,
    salesOrders: soRows,
    sampleOrders: sampleRows,
    meetings: meetingRows,
    projects: projectRows,
  };
}

export type PipelineOpp = {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  valueCents: number;
  probability: number;
  nextStep: string | null;
  stage: Stage;
};
export type PipelineColumn = { stage: Stage; opps: PipelineOpp[]; totalCents: number };

/** Opportunities grouped into stage columns, each ordered by value desc. */
export async function pipelineByStage(): Promise<PipelineColumn[]> {
  const rows = await db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      accountId: opportunities.accountId,
      accountName: accounts.name,
      valueCents: opportunities.valueCents,
      probability: opportunities.probability,
      nextStep: opportunities.nextStep,
      stage: opportunities.stage,
    })
    .from(opportunities)
    .leftJoin(accounts, eq(accounts.id, opportunities.accountId))
    .orderBy(desc(opportunities.valueCents));

  const cols: PipelineColumn[] = STAGE_ORDER.map((stage) => ({ stage, opps: [], totalCents: 0 }));
  const byStage = new Map(cols.map((c) => [c.stage, c]));
  for (const r of rows) {
    const col = byStage.get(r.stage as Stage);
    if (!col) continue;
    col.opps.push({
      id: r.id,
      name: r.name,
      accountId: r.accountId,
      accountName: r.accountName ?? "—",
      valueCents: r.valueCents,
      probability: r.probability,
      nextStep: r.nextStep,
      stage: r.stage as Stage,
    });
    col.totalCents += r.valueCents;
  }
  return cols;
}
