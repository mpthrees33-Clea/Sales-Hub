import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { emails, emailThreads } from "@/db/schema";
import { getDemoNow } from "@/lib/demo-clock";
import { REP } from "@/lib/rep";
import type { EmailMessage, EmailProvider, EmailThreadView, OutboundDraft } from "./types";

function toMessage(row: typeof emails.$inferSelect): EmailMessage {
  return {
    id: row.id,
    threadId: row.threadId,
    direction: row.direction,
    from: row.fromEmail,
    to: row.toEmails,
    cc: row.ccEmails,
    subject: row.subject,
    bodyText: row.bodyText,
    receivedAt: row.receivedAt,
    attachments: row.attachments,
    isProcessed: row.isProcessed,
  };
}

/**
 * Demo mailbox over the seeded tables. "Sending" appends the outbound message
 * to the thread in-app — nothing leaves the building.
 */
export class DemoEmailProvider implements EmailProvider {
  async listNewMessages(since: Date): Promise<EmailMessage[]> {
    const rows = await db
      .select()
      .from(emails)
      .where(and(eq(emails.direction, "inbound"), eq(emails.isProcessed, false), gt(emails.receivedAt, since)))
      .orderBy(asc(emails.receivedAt));
    return rows.map(toMessage);
  }

  async getThread(id: string): Promise<EmailThreadView> {
    const thread = await db.query.emailThreads.findFirst({ where: eq(emailThreads.id, id) });
    if (!thread) throw new Error(`thread ${id} not found`);
    const msgs = await db.select().from(emails).where(eq(emails.threadId, id)).orderBy(asc(emails.receivedAt));
    return {
      id: thread.id,
      subject: thread.subject,
      participants: thread.participants,
      lastMessageAt: thread.lastMessageAt,
      status: thread.status,
      messages: msgs.map(toMessage),
    };
  }

  async createDraft(draft: OutboundDraft): Promise<{ draftId: string; threadId: string }> {
    const demoNow = await getDemoNow();
    let threadId = draft.threadId;
    if (!threadId && draft.inReplyToEmailId) {
      const source = await db.query.emails.findFirst({ where: eq(emails.id, draft.inReplyToEmailId) });
      threadId = source?.threadId;
    }
    if (!threadId) {
      const [t] = await db
        .insert(emailThreads)
        .values({
          subject: draft.subject,
          participants: [REP.email, ...draft.to],
          lastMessageAt: demoNow,
          status: "active",
        })
        .returning({ id: emailThreads.id });
      threadId = t!.id;
    }
    const [row] = await db
      .insert(emails)
      .values({
        threadId,
        direction: "outbound",
        fromEmail: REP.email,
        toEmails: draft.to,
        ccEmails: draft.cc ?? [],
        subject: draft.subject,
        bodyText: draft.bodyText,
        receivedAt: demoNow,
        attachments: [],
        isProcessed: true,
      })
      .returning({ id: emails.id });
    await db.update(emailThreads).set({ lastMessageAt: demoNow }).where(eq(emailThreads.id, threadId));
    return { draftId: row!.id, threadId };
  }

  async send(draftId: string): Promise<{ sentEmailId: string }> {
    // Demo semantics: the draft row created by createDraft IS the sent message
    // (marked sent in-app only). Live Graph would POST /send here.
    return { sentEmailId: draftId };
  }
}
