/** Meetings (WO-07 task 5) — Today (via CalendarProvider) + Past, with status chips. */
import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { formatTimeShort } from "@/lib/dates";
import { listMeetings, type MeetingRow } from "@/lib/queries/meetings";

export const dynamic = "force-dynamic";

const STATUS: Record<MeetingRow["status"], { tone: "muted" | "accent" | "ok"; label: string }> = {
  scheduled: { tone: "muted", label: "scheduled" },
  recorded: { tone: "accent", label: "recorded" },
  transcribed: { tone: "accent", label: "transcribed" },
  follow_up_drafted: { tone: "ok", label: "follow-up drafted" },
};

function Row({ m }: { m: MeetingRow }) {
  return (
    <Link href={`/meetings/${m.id}`} className="block px-4 py-3 transition-colors hover:bg-surface2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{m.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
            {formatTimeShort(new Date(m.startsAt))}{m.accountName ? ` · ${m.accountName}` : ""}
          </p>
          {m.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint"><MapPin className="h-3 w-3" />{m.location}</p>
          ) : null}
          {m.prepNotes ? <p className="mt-1 line-clamp-2 text-[11px] text-ink-muted">{m.prepNotes}</p> : null}
        </div>
        <StatusPill tone={STATUS[m.status].tone}>{STATUS[m.status].label}</StatusPill>
      </div>
    </Link>
  );
}

export default async function Page() {
  const { today, past } = await listMeetings();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Meetings</h1>

      <Card>
        <CardHeader title="Today" n="01" right={<span className="font-mono text-[10px] text-ink-faint">{today.length}</span>} />
        {today.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing on the calendar today" copy="Meetings for the day appear here with prep notes; record after the site walk." />
        ) : (
          <div className="divide-y divide-line">{today.map((m) => <Row key={m.id} m={m} />)}</div>
        )}
      </Card>

      <Card>
        <CardHeader title="Past" n="02" right={<span className="font-mono text-[10px] text-ink-faint">{past.length}</span>} />
        {past.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No past meetings" copy="Recorded meetings and their drafted follow-ups land here." />
        ) : (
          <div className="divide-y divide-line">{past.map((m) => <Row key={m.id} m={m} />)}</div>
        )}
      </Card>
    </div>
  );
}
