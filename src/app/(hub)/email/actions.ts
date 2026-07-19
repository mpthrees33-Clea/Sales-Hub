"use server";

/**
 * Email-center server actions (WO-04 task 11). Triage re-runs, AI reply/compose
 * (both terminate as email_draft approvals — no send path here), and archival.
 * Each mutation writes audit_log via the single audit() helper.
 */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailThreads } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { triageEmail } from "@/agents/email-triage";
import { emailReplyAgent, replyToRouting } from "@/agents/email-reply";

export async function rerunTriageAction(emailId: string): Promise<{ category: string }> {
  await requireSession();
  const result = await triageEmail(emailId, { trigger: "user" });
  revalidatePath("/email");
  revalidatePath("/dashboard");
  return { category: (result.output?.category as string) ?? "escalated" };
}

export async function draftReplyAction(routingId: string): Promise<{ approvalId: string | null; status: string }> {
  await requireSession();
  const run = await replyToRouting(routingId, { trigger: "user" });
  revalidatePath("/email");
  revalidatePath("/approvals");
  return { approvalId: run.approvalIds[0] ?? null, status: run.status };
}

export async function draftQuoteAction(routingId: string): Promise<{ approvalId: string | null; status: string }> {
  await requireSession();
  const { runQuoteFromRouting } = await import("@/lib/quotes");
  const r = await runQuoteFromRouting(routingId, { trigger: "user" });
  revalidatePath("/email");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  return { approvalId: r.status === "drafted" ? r.approvalId : null, status: r.status };
}

export async function composeAction(input: {
  to: string[];
  subject?: string;
  intent: string;
  accountId?: string;
}): Promise<{ approvalId: string | null; status: string }> {
  await requireSession();
  const run = await emailReplyAgent.run({ mode: "compose", ...input }, { trigger: "user" });
  revalidatePath("/email");
  revalidatePath("/approvals");
  return { approvalId: run.approvalIds[0] ?? null, status: run.status };
}

export async function archiveThreadAction(threadId: string, archived: boolean): Promise<void> {
  await requireSession();
  await db.update(emailThreads).set({ status: archived ? "archived" : "active" }).where(eq(emailThreads.id, threadId));
  await audit({
    actor: `user:${(await requireSession()).userId}`,
    action: archived ? "thread.archived" : "thread.unarchived",
    objectType: "email_thread",
    objectId: threadId,
  });
  revalidatePath("/email");
}
