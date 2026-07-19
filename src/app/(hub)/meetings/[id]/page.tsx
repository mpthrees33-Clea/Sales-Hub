import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { accounts, approvals, meetings, projects, transcripts } from "@/db/schema";
import { Card, CardHeader, Mono, StatusPill } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { MeetingDetailClient } from "./meeting-detail-client";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seg?: string }>;
}) {
  const { id } = await params;
  const { seg } = await searchParams;
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, id) });
  if (!meeting) notFound();
  const [account, project, transcript, pendingApprovals] = await Promise.all([
    meeting.accountId ? db.query.accounts.findFirst({ where: eq(accounts.id, meeting.accountId) }) : null,
    meeting.projectId ? db.query.projects.findFirst({ where: eq(projects.id, meeting.projectId) }) : null,
    db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, id) }),
    db
      .select({ id: approvals.id, kind: approvals.kind })
      .from(approvals)
      .where(and(eq(approvals.status, "pending"), sql`${approvals.proposedAction} ->> 'meetingId' = ${id}`)),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/meetings" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
            <ArrowLeft className="h-4 w-4 text-ink-muted" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{meeting.title}</h1>
            <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
              {account?.name ?? ""} {project ? `· ${project.name}` : ""} · {formatDateTime(meeting.startsAt)} ·{" "}
              {meeting.location}
            </p>
          </div>
        </div>
        <StatusPill tone={meeting.status === "completed" ? "ok" : "accent"}>{meeting.status}</StatusPill>
      </div>

      {meeting.prepNotes ? (
        <Card>
          <CardHeader n="00" title="Prep notes" />
          <p className="px-4 py-3 text-[12px] leading-relaxed text-ink-muted">{meeting.prepNotes}</p>
        </Card>
      ) : null}

      <MeetingDetailClient
        meetingId={meeting.id}
        transcript={transcript ? { audioBlobUrl: transcript.audioBlobUrl, segments: transcript.segments, summary: transcript.summary, actionItems: transcript.actionItems } : null}
        pendingApprovals={pendingApprovals}
        initialSeg={seg ? parseInt(seg, 10) : undefined}
      />

      <p className="font-mono text-[10px] text-ink-faint">
        Every summary bullet and CRM delta is pinned to transcript segments — <Mono>every answer shows its source</Mono>.
        Drafts only — humans send.
      </p>
    </div>
  );
}
