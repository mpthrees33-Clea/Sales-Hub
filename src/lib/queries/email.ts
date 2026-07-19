/**
 * Email-center reads (WO-04). Server-only. Builds the thread list with triage
 * pills and "draft ready" linkage (a pending email_draft approval whose
 * in-reply-to message belongs to the thread), and the full thread view.
 */
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, emails, emailThreads, triageRoutings } from "@/db/schema";

export type ThreadRow = {
  id: string;
  subject: string;
  lastMessageAt: string;
  triage: string | null;
  triageConfidence: number | null;
  status: "active" | "archived" | "needs_review";
  latestFrom: string;
  latestDirection: "inbound" | "outbound";
  snippet: string;
  inboundEmailId: string | null;
  routingId: string | null;
  routingTarget: string | null;
  draftApprovalId: string | null;
};

/** Map each pending email_draft approval to the thread of its in-reply-to message. */
async function draftApprovalByThread(): Promise<Map<string, string>> {
  const pending = await db
    .select({ id: approvals.id, proposed: approvals.proposedAction })
    .from(approvals)
    .where(eq(approvals.kind, "email_draft"));
  const inReplyIds = pending
    .map((a) => (a.proposed as { inReplyToEmailId?: string }).inReplyToEmailId)
    .filter((v): v is string => !!v);
  if (inReplyIds.length === 0) return new Map();
  const msgs = await db.select({ id: emails.id, threadId: emails.threadId }).from(emails);
  const threadOf = new Map(msgs.map((m) => [m.id, m.threadId]));
  const out = new Map<string, string>();
  for (const a of pending) {
    const irt = (a.proposed as { inReplyToEmailId?: string; status?: string }).inReplyToEmailId;
    if (!irt) continue;
    const threadId = threadOf.get(irt);
    if (threadId) out.set(threadId, a.id);
  }
  return out;
}

export async function loadThreads(): Promise<ThreadRow[]> {
  const [threads, allEmails, routings, draftMap] = await Promise.all([
    db.select().from(emailThreads).orderBy(desc(emailThreads.lastMessageAt)),
    db.select().from(emails).orderBy(asc(emails.receivedAt)),
    db.select().from(triageRoutings),
    draftApprovalByThread(),
  ]);

  const byThread = new Map<string, (typeof allEmails)>();
  for (const e of allEmails) {
    const arr = byThread.get(e.threadId) ?? [];
    arr.push(e);
    byThread.set(e.threadId, arr);
  }
  const routingByThread = new Map(routings.map((r) => [r.threadId, r]));

  return threads.map((t) => {
    const msgs = byThread.get(t.id) ?? [];
    const latest = msgs[msgs.length - 1];
    const inbound = [...msgs].reverse().find((m) => m.direction === "inbound");
    const routing = routingByThread.get(t.id);
    return {
      id: t.id,
      subject: t.subject,
      lastMessageAt: t.lastMessageAt.toISOString(),
      triage: t.triage,
      triageConfidence: t.triageConfidence != null ? Number(t.triageConfidence) : null,
      status: t.status,
      latestFrom: latest?.fromEmail ?? "",
      latestDirection: latest?.direction ?? "inbound",
      snippet: (latest?.bodyText ?? "").replace(/\s+/g, " ").slice(0, 120),
      inboundEmailId: inbound?.id ?? null,
      routingId: routing?.id ?? null,
      routingTarget: routing?.target ?? null,
      draftApprovalId: draftMap.get(t.id) ?? null,
    };
  });
}

export type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  subject: string;
  bodyText: string;
  receivedAt: string;
  attachments: { name: string; blobKey: string; contentType: string }[];
};

export type ThreadDetail = {
  id: string;
  subject: string;
  status: string;
  messages: ThreadMessage[];
  triage: string | null;
  triageConfidence: number | null;
  routingId: string | null;
  routingTarget: string | null;
  draftApprovalId: string | null;
};

/** Everything the email center needs in one pass: summaries + full details. */
export async function loadEmailCenter(): Promise<{ threads: ThreadRow[]; details: Record<string, ThreadDetail> }> {
  const [threads, allEmails, routings, draftMap] = await Promise.all([
    db.select().from(emailThreads).orderBy(desc(emailThreads.lastMessageAt)),
    db.select().from(emails).orderBy(asc(emails.receivedAt)),
    db.select().from(triageRoutings),
    draftApprovalByThread(),
  ]);
  const byThread = new Map<string, typeof allEmails>();
  for (const e of allEmails) {
    const arr = byThread.get(e.threadId) ?? [];
    arr.push(e);
    byThread.set(e.threadId, arr);
  }
  const routingByThread = new Map(routings.map((r) => [r.threadId, r]));

  const rows: ThreadRow[] = [];
  const details: Record<string, ThreadDetail> = {};
  for (const t of threads) {
    const msgs = byThread.get(t.id) ?? [];
    const latest = msgs[msgs.length - 1];
    const inbound = [...msgs].reverse().find((m) => m.direction === "inbound");
    const routing = routingByThread.get(t.id);
    rows.push({
      id: t.id,
      subject: t.subject,
      lastMessageAt: t.lastMessageAt.toISOString(),
      triage: t.triage,
      triageConfidence: t.triageConfidence != null ? Number(t.triageConfidence) : null,
      status: t.status,
      latestFrom: latest?.fromEmail ?? "",
      latestDirection: latest?.direction ?? "inbound",
      snippet: (latest?.bodyText ?? "").replace(/\s+/g, " ").slice(0, 120),
      inboundEmailId: inbound?.id ?? null,
      routingId: routing?.id ?? null,
      routingTarget: routing?.target ?? null,
      draftApprovalId: draftMap.get(t.id) ?? null,
    });
    details[t.id] = {
      id: t.id,
      subject: t.subject,
      status: t.status,
      messages: msgs.map((m) => ({
        id: m.id,
        direction: m.direction,
        from: m.fromEmail,
        to: m.toEmails,
        subject: m.subject,
        bodyText: m.bodyText,
        receivedAt: m.receivedAt.toISOString(),
        attachments: m.attachments,
      })),
      triage: t.triage,
      triageConfidence: t.triageConfidence != null ? Number(t.triageConfidence) : null,
      routingId: routing?.id ?? null,
      routingTarget: routing?.target ?? null,
      draftApprovalId: draftMap.get(t.id) ?? null,
    };
  }
  return { threads: rows, details };
}

export async function loadThread(id: string): Promise<ThreadDetail | null> {
  const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, id) });
  if (!thread) return null;
  const msgs = await db.select().from(emails).where(eq(emails.threadId, id)).orderBy(asc(emails.receivedAt));
  const routing = await db.query.triageRoutings.findFirst({ where: eq(triageRoutings.threadId, id) });
  const draftMap = await draftApprovalByThread();
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    messages: msgs.map((m) => ({
      id: m.id,
      direction: m.direction,
      from: m.fromEmail,
      to: m.toEmails,
      subject: m.subject,
      bodyText: m.bodyText,
      receivedAt: m.receivedAt.toISOString(),
      attachments: m.attachments,
    })),
    triage: thread.triage,
    triageConfidence: thread.triageConfidence != null ? Number(thread.triageConfidence) : null,
    routingId: routing?.id ?? null,
    routingTarget: routing?.target ?? null,
    draftApprovalId: draftMap.get(id) ?? null,
  };
}
