/**
 * Test helper: restore the staged Monday batch to its pre-triage state so
 * suites are order-independent (mirrors the film-day reset semantics).
 */
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { emails, emailThreads } from "@/db/schema";
import { INBOUND_MONDAY } from "@/db/seed/fixtures/emails";
import { sid } from "@/db/seed/ids";

export async function resetStagedBatch(): Promise<void> {
  const emailIds = INBOUND_MONDAY.map((f) => sid(`email:${f.key}`));
  const threadIds = INBOUND_MONDAY.map((f) => sid(`thread:${f.key}`));
  await db.execute(sql`delete from triage_routings`);
  await db.execute(sql`delete from approvals`);
  await db.execute(sql`delete from quotes where number not in ('Q-1041','Q-1042')`);
  await db.update(emails).set({ isProcessed: false }).where(inArray(emails.id, emailIds));
  await db
    .update(emailThreads)
    .set({ triage: null, triageConfidence: null, status: "active" })
    .where(inArray(emailThreads.id, threadIds));
}
