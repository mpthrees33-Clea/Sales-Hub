/**
 * Meeting detail (WO-07 task 6) — header, recorder/transcript, summary, action
 * items, CRM-delta panel with clickable transcript-segment evidence, follow-up CTA.
 */
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckSquare, MapPin, Mic } from "lucide-react";
import { Card, CardHeader, StatusPill } from "@/components/ui";
import { TranscriptView } from "@/components/transcript-view";
import { formatDateTime } from "@/lib/dates";
import { getMeeting } from "@/lib/queries/meetings";
import { Recorder } from "./recorder";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMeeting(id);
  if (!m) notFound();
  const hasTranscript = m.segments.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/meetings" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> meetings
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{m.title}</h1>
        {m.summary ? <StatusPill tone="ok">follow-up drafted</StatusPill> : hasTranscript ? <StatusPill tone="accent">transcribed</StatusPill> : null}
      </div>

      <Card className="p-4">
        <p className="font-mono text-[11px] text-ink-muted">{formatDateTime(new Date(m.startsAt))}{m.accountName ? ` · ${m.accountName}` : ""}{m.projectName ? ` · ${m.projectName}` : ""}</p>
        {m.location ? <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint"><MapPin className="h-3 w-3" />{m.location}</p> : null}
        {m.prepNotes ? <p className="mt-2 text-[12px] text-ink-muted"><span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">prep</span> {m.prepNotes}</p> : null}
      </Card>

      {!hasTranscript ? (
        <Recorder meetingId={m.id} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Transcript" n="01" right={<Mic className="h-3.5 w-3.5 text-ink-faint" />} />
            <div className="max-h-[520px] overflow-y-auto p-3">
              <Suspense fallback={<p className="p-3 font-mono text-[11px] text-ink-faint">loading…</p>}>
                <TranscriptView segments={m.segments} />
              </Suspense>
            </div>
          </Card>

          <div className="space-y-4">
            {m.summary ? (
              <Card>
                <CardHeader title="Summary" n="02" />
                <ul className="space-y-1.5 p-4 text-[12px] leading-relaxed text-ink-muted">
                  {m.summary.split("\n").map((s, i) => <li key={i} className="flex gap-2"><span className="text-accent">·</span>{s}</li>)}
                </ul>
              </Card>
            ) : null}

            {m.actionItems.length > 0 ? (
              <Card>
                <CardHeader title="Action items" n="03" />
                <ul className="divide-y divide-line">
                  {m.actionItems.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 px-4 py-2 text-[12px]">
                      <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      <span><span className="text-ink">{a.text}</span> <span className="font-mono text-[10px] text-ink-faint">· {a.owner}{a.dueHint ? ` · ${a.dueHint}` : ""}</span></span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {m.opportunityDeltas.length > 0 ? (
              <Card>
                <CardHeader title="CRM deltas" n="04" />
                <ul className="divide-y divide-line">
                  {m.opportunityDeltas.map((d) => (
                    <li key={d.approvalId} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium">{d.name}</span>
                        <Link href={`/approvals?id=${d.approvalId}`} className="font-mono text-[10px] text-accent hover:underline">review →</Link>
                      </div>
                      {d.fieldDiffs.filter((f) => f.field !== "__create__").map((f, i) => (
                        <div key={i} className="mt-1 flex flex-wrap items-baseline gap-1.5 text-[11px]">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{f.field}</span>
                          <span className="text-ink-muted line-through">{String(f.old ?? "—")}</span>
                          <span className="text-ink-faint">→</span>
                          <span className="text-ink">{String(f.new ?? "—")}</span>
                        </div>
                      ))}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {d.segmentRefs.map((s) => (
                          <Link key={s} href={`/meetings/${m.id}?seg=${s}`} scroll={false} className="rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-accent hover:border-accent">
                            transcript #{s}
                          </Link>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {m.followupApprovalId ? (
              <Link href={`/approvals?id=${m.followupApprovalId}`} className="block rounded-lg border border-accent/40 bg-accent-dim px-4 py-3 text-center font-mono text-[12px] text-accent hover:border-accent">
                Review follow-up draft →
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
