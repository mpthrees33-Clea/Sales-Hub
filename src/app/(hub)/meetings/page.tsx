import Link from "next/link";
import { desc, eq, lte } from "drizzle-orm";
import { Mic } from "lucide-react";
import { db } from "@/db/client";
import { accounts, meetings, transcripts, approvals } from "@/db/schema";
import { and, sql } from "drizzle-orm";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { dayBounds, formatDateTime, formatTimeShort } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { getCalendarProvider } from "@/providers";
import { leaveBysForToday } from "@/lib/leave-bys";
import { LeaveByChip } from "@/app/(hub)/dashboard/_components/leave-by-chip";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const demoNow = await getDemoNow();
  const { start, end } = dayBounds(demoNow);
  const [today, leaveBys] = await Promise.all([
    getCalendarProvider().listEvents({ start, end }),
    leaveBysForToday(),
  ]);

  const past = await db
    .select({ meeting: meetings, accountName: accounts.name, transcriptId: transcripts.id, summary: transcripts.summary })
    .from(meetings)
    .leftJoin(accounts, eq(accounts.id, meetings.accountId))
    .leftJoin(transcripts, eq(transcripts.meetingId, meetings.id))
    .where(lte(meetings.startsAt, start))
    .orderBy(desc(meetings.startsAt))
    .limit(20);

  // Follow-up drafted state: pending approvals keyed by meetingId.
  const pendingByMeeting = new Set(
    (
      await db
        .select({ meetingId: sql<string>`${approvals.proposedAction} ->> 'meetingId'` })
        .from(approvals)
        .where(and(eq(approvals.status, "pending"), sql`${approvals.proposedAction} ? 'meetingId'`))
    ).map((r) => r.meetingId),
  );

  const accountName = async (id: string | null) =>
    id ? (await db.query.accounts.findFirst({ where: eq(accounts.id, id) }))?.name : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Meetings</h1>

      <Card>
        <CardHeader n="01" title="Today" />
        {today.length === 0 ? (
          <EmptyState icon={Mic} title="No meetings today" copy="Today's docket appears here with prep notes and leave-by chips." />
        ) : (
          <ul className="divide-y divide-line">
            {await Promise.all(
              today.map(async (m) => (
                <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-16 shrink-0 pt-0.5">
                    <div className="font-mono text-xs">{formatTimeShort(m.startsAt)}</div>
                    <div className="font-mono text-[10px] text-ink-faint">{formatTimeShort(m.endsAt)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/meetings/${m.id}`} className="text-[13px] font-medium hover:text-accent">
                      {m.title}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                      {(await accountName(m.accountId)) ?? ""} · {m.location}
                    </p>
                    {m.prepNotes ? (
                      <p className="mt-1 text-[11px] leading-snug text-ink-muted [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                        {m.prepNotes}
                      </p>
                    ) : null}
                  </div>
                  <LeaveByChip
                    leaveBy={leaveBys.get(m.id)?.leaveBy}
                    tight={leaveBys.get(m.id)?.tight}
                    tooltip={leaveBys.get(m.id)?.tooltip}
                  />
                </li>
              )),
            )}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader n="02" title="Past" />
        {past.length === 0 ? (
          <EmptyState icon={Mic} title="No past meetings" copy="Recorded meetings and their transcripts land here." />
        ) : (
          <ul className="divide-y divide-line">
            {past.map(({ meeting, accountName: acct, transcriptId, summary }) => {
              const state = summary
                ? pendingByMeeting.has(meeting.id)
                  ? "follow-up drafted"
                  : "processed"
                : transcriptId
                  ? "transcribed"
                  : meeting.status === "completed"
                    ? "recorded"
                    : "scheduled";
              return (
                <li key={meeting.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/meetings/${meeting.id}`} className="text-[13px] font-medium hover:text-accent">
                      {meeting.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                      {acct ?? ""} · {formatDateTime(meeting.startsAt)}
                    </p>
                  </div>
                  <StatusPill tone={state === "follow-up drafted" ? "ok" : state === "transcribed" || state === "processed" ? "accent" : "muted"}>
                    {state}
                  </StatusPill>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
