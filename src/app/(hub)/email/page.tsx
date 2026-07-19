/**
 * Email Center (WO-04) — three-pane inbox over the seeded threads with triage
 * pills, AI reply/compose (approval-gated), and the style-profile card. Server
 * component: loads threads + details + contacts once, hands them to the client.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, contacts as contactsTable } from "@/db/schema";
import { loadEmailCenter } from "@/lib/queries/email";
import { getDemoNow } from "@/lib/demo-clock";
import { EmailCenter } from "./_components/email-center";
import { StyleProfileCard } from "./_components/style-profile-card";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ threads, details }, contactRows, demoNow] = await Promise.all([
    loadEmailCenter(),
    db
      .select({ email: contactsTable.email, name: contactsTable.name, accountId: contactsTable.accountId })
      .from(contactsTable)
      .innerJoin(accounts, eq(accounts.id, contactsTable.accountId))
      .orderBy(asc(contactsTable.name)),
    getDemoNow(),
  ]);

  return (
    <div className="space-y-4">
      <EmailCenter threads={threads} details={details} contacts={contactRows} demoNow={demoNow.toISOString()} />
      <div className="mx-auto max-w-6xl">
        <StyleProfileCard />
      </div>
    </div>
  );
}
