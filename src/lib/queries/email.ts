/** Email center query module (WO-04). Server-only. */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, contacts, emails, emailThreads, triageRoutings } from "@/db/schema";

export type ThreadFilter =
  | "all"
  | "needs_review"
  | "archived"
  | "drafts_pending"
  | "quote_request"
  | "stock_check"
  | "po"
  | "sample_request"
  | "submittal_request"
  | "scheduling"
  | "general"
  | "noise";

export type ThreadListItem = {
  id: string;
  subject: string;
  participants: string[];
  lastMessageAt: Date;
  triage: string | null;
  triageConfidence: number | null;
  status: string;
  preview: string;
  unprocessedCount: number;
  draftApprovalId: string | null;
};

export async function threadList(filter: ThreadFilter): Promise<ThreadListItem[]> {
  const rows = await db
    .select()
    .from(emailThreads)
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(200);

  // Pending email_draft approvals mapped back to threads (draft-ready chips).
  const pendingDrafts = await db
    .select({ id: approvals.id, inReplyTo: sql<string | null>`${approvals.proposedAction} ->> 'inReplyToEmailId'` })
    .from(approvals)
    .where(and(eq(approvals.status, "pending"), eq(approvals.kind, "email_draft")));
  const replyIds = pendingDrafts.map((d) => d.inReplyTo).filter((x): x is string => Boolean(x));
  const replyEmailRows = replyIds.length
    ? await db
        .select({ id: emails.id, threadId: emails.threadId })
        .from(emails)
        .where(inArray(emails.id, replyIds))
    : [];
  const draftByThread = new Map<string, string>();
  for (const d of pendingDrafts) {
    const email = replyEmailRows.find((e) => e.id === d.inReplyTo);
    if (email) draftByThread.set(email.threadId, d.id);
  }

  const previews = await db
    .select({
      threadId: emails.threadId,
      body: sql<string>`substring(max(${emails.bodyText}) for 160)`,
      unprocessed: sql<number>`count(*) filter (where ${emails.direction} = 'inbound' and not ${emails.isProcessed})::int`,
    })
    .from(emails)
    .groupBy(emails.threadId);
  const previewByThread = new Map(previews.map((p) => [p.threadId, p]));

  const items: ThreadListItem[] = rows.map((t) => ({
    id: t.id,
    subject: t.subject,
    participants: t.participants,
    lastMessageAt: t.lastMessageAt,
    triage: t.triage,
    triageConfidence: t.triageConfidence ? Number(t.triageConfidence) : null,
    status: t.status,
    preview: previewByThread.get(t.id)?.body?.replace(/\n+/g, " ") ?? "",
    unprocessedCount: previewByThread.get(t.id)?.unprocessed ?? 0,
    draftApprovalId: draftByThread.get(t.id) ?? null,
  }));

  switch (filter) {
    case "all":
      return items.filter((t) => t.status !== "archived");
    case "archived":
      return items.filter((t) => t.status === "archived");
    case "needs_review":
      return items.filter((t) => t.status === "needs_review");
    case "drafts_pending":
      return items.filter((t) => t.draftApprovalId);
    default:
      return items.filter((t) => t.triage === filter && t.status !== "archived");
  }
}

export async function threadDetail(id: string) {
  const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, id) });
  if (!thread) return null;
  const messages = await db.query.emails.findMany({
    where: eq(emails.threadId, id),
    orderBy: (t, { asc }) => asc(t.receivedAt),
  });
  const routings = await db.query.triageRoutings.findMany({ where: eq(triageRoutings.threadId, id) });
  return { thread, messages, routings };
}

export async function contactOptions(): Promise<{ name: string; email: string; account: string }[]> {
  const rows = await db
    .select({ name: contacts.name, email: contacts.email, accountId: contacts.accountId })
    .from(contacts)
    .orderBy(contacts.name);
  const accountRows = await db.query.accounts.findMany({ columns: { id: true, name: true } });
  const nameById = new Map(accountRows.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ name: r.name, email: r.email, account: nameById.get(r.accountId) ?? "" }));
}

export async function filterCounts(): Promise<Record<string, number>> {
  const all = await threadList("all");
  const archived = await threadList("archived");
  const counts: Record<string, number> = {
    all: all.length,
    archived: archived.length,
    needs_review: all.filter((t) => t.status === "needs_review").length,
    drafts_pending: all.filter((t) => t.draftApprovalId).length,
  };
  for (const c of ["quote_request", "stock_check", "po", "sample_request", "submittal_request", "scheduling", "general"]) {
    counts[c] = all.filter((t) => t.triage === c).length;
  }
  return counts;
}
