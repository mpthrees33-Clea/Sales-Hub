/** Meetings reads (WO-07). Server-only. Today via CalendarProvider; detail direct. */
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, activities, approvals, meetings, projects, transcripts, type ActionItem, type TranscriptSegment } from "@/db/schema";
import { getCalendarProvider } from "@/providers";
import { getDemoNow } from "@/lib/demo-clock";
import { dayBounds } from "@/lib/dates";

export type MeetingRow = {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  accountName: string | null;
  prepNotes: string | null;
  status: "scheduled" | "recorded" | "transcribed" | "follow_up_drafted";
  isToday: boolean;
};

async function statusOf(meetingId: string, hasTranscript: boolean, hasSummary: boolean): Promise<MeetingRow["status"]> {
  if (hasSummary) return "follow_up_drafted";
  if (hasTranscript) return "transcribed";
  const done = await db.select({ id: activities.id }).from(activities).where(eq(activities.refId, meetingId));
  return done.length ? "recorded" : "scheduled";
}

export async function listMeetings(): Promise<{ today: MeetingRow[]; past: MeetingRow[] }> {
  const now = await getDemoNow();
  const day = dayBounds(now);
  const todayEvents = await getCalendarProvider().listEvents({ start: day.start, end: day.end });
  const todayIds = new Set(todayEvents.map((e) => e.id));

  const all = await db
    .select({ m: meetings, accountName: accounts.name })
    .from(meetings)
    .leftJoin(accounts, eq(accounts.id, meetings.accountId))
    .orderBy(desc(meetings.startsAt));

  const transcriptRows = await db.select({ meetingId: transcripts.meetingId, summary: transcripts.summary, segments: transcripts.segments }).from(transcripts);
  const tByMeeting = new Map(transcriptRows.map((t) => [t.meetingId, t]));

  const rows: MeetingRow[] = [];
  for (const { m, accountName } of all) {
    const t = tByMeeting.get(m.id);
    rows.push({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt.toISOString(),
      location: m.location,
      accountName,
      prepNotes: m.prepNotes,
      status: await statusOf(m.id, !!(t?.segments && t.segments.length > 0), !!t?.summary),
      isToday: todayIds.has(m.id),
    });
  }
  return { today: rows.filter((r) => r.isToday), past: rows.filter((r) => !r.isToday) };
}

export type MeetingDetail = {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  accountName: string | null;
  projectName: string | null;
  prepNotes: string | null;
  audioBlobUrl: string | null;
  segments: TranscriptSegment[];
  summary: string | null;
  actionItems: ActionItem[];
  followupApprovalId: string | null;
  opportunityDeltas: { approvalId: string; name: string; fieldDiffs: { field: string; old: unknown; new: unknown }[]; segmentRefs: number[] }[];
};

export async function getMeeting(id: string): Promise<MeetingDetail | null> {
  const [row] = await db
    .select({ m: meetings, accountName: accounts.name, projectName: projects.name })
    .from(meetings)
    .leftJoin(accounts, eq(accounts.id, meetings.accountId))
    .leftJoin(projects, eq(projects.id, meetings.projectId))
    .where(eq(meetings.id, id))
    .limit(1);
  if (!row) return null;
  const t = await db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, id) });

  // Approvals from the follow-up run (by run's meeting association via evidence ref).
  const apprs = await db.select({ id: approvals.id, kind: approvals.kind, proposed: approvals.proposedAction, evidence: approvals.evidence }).from(approvals).orderBy(asc(approvals.createdDemoAt));
  const forThisMeeting = apprs.filter((a) => a.evidence.some((e) => e.type === "transcript_segment" && (e.ref as { meetingId?: string }).meetingId === id));
  const followup = forThisMeeting.find((a) => a.kind === "email_draft");
  const oppDeltas = forThisMeeting
    .filter((a) => a.kind === "opportunity_update")
    .map((a) => {
      const p = a.proposed as { newOpportunity?: { name?: string }; fieldDiffs?: { field: string; old: unknown; new: unknown }[] };
      return {
        approvalId: a.id,
        name: p.newOpportunity?.name ?? "Opportunity update",
        fieldDiffs: p.fieldDiffs ?? [],
        segmentRefs: a.evidence.filter((e) => e.type === "transcript_segment").map((e) => (e.ref as { segment?: number }).segment ?? 0),
      };
    });

  return {
    id: row.m.id,
    title: row.m.title,
    startsAt: row.m.startsAt.toISOString(),
    location: row.m.location,
    accountName: row.accountName,
    projectName: row.projectName,
    prepNotes: row.m.prepNotes,
    audioBlobUrl: t?.audioBlobUrl ?? null,
    segments: t?.segments ?? [],
    summary: t?.summary ?? null,
    actionItems: t?.actionItems ?? [],
    followupApprovalId: followup?.id ?? null,
    opportunityDeltas: oppDeltas,
  };
}
