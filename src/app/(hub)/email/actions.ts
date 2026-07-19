"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailThreads } from "@/db/schema";
import { runTriageForEmail } from "@/agents/email-triage";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";

export async function archiveThread(threadId: string, archived: boolean) {
  const session = await requireSession();
  await db
    .update(emailThreads)
    .set({ status: archived ? "archived" : "active" })
    .where(eq(emailThreads.id, threadId));
  await audit({
    actor: `user:${session.userId}`,
    action: archived ? "thread.archived" : "thread.unarchived",
    objectType: "email_thread",
    objectId: threadId,
  });
  revalidatePath("/email");
}

/** Re-run triage on a thread's latest inbound email (idempotent routing upsert). */
export async function rerunTriage(threadId: string) {
  const session = await requireSession();
  const latest = await db.query.emails.findFirst({
    where: (t, { and, eq: e }) => and(e(t.threadId, threadId), e(t.direction, "inbound")),
    orderBy: (t, { desc }) => desc(t.receivedAt),
  });
  if (!latest) return { ok: false as const, error: "no inbound message on thread" };
  const { result } = await runTriageForEmail(latest.id, { trigger: "user" });
  await audit({
    actor: `user:${session.userId}`,
    action: "triage.rerun",
    objectType: "email",
    objectId: latest.id,
    detail: { status: result.status },
  });
  revalidatePath("/email");
  return { ok: true as const, status: result.status };
}
