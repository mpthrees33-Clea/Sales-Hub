"use client";

/**
 * Meeting detail interactive surface (WO-07): recorder/upload (phone-width
 * first), pipeline progress, speaker-colored transcript with evidence
 * deep-links (?seg=), summary + action items + CRM-delta panel, follow-up
 * CTA into Approvals.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckSquare, ListChecks, Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { TranscriptView } from "@/components/transcript-view";
import type { ActionItem, TranscriptSegment } from "@/db/schema";
import { Recorder } from "./recorder";

export function MeetingDetailClient({
  meetingId,
  transcript,
  pendingApprovals,
  initialSeg,
}: {
  meetingId: string;
  transcript: {
    audioBlobUrl: string | null;
    segments: TranscriptSegment[] | null;
    summary: string | null;
    actionItems: ActionItem[] | null;
  } | null;
  pendingApprovals: { id: string; kind: string }[];
  initialSeg?: number;
}) {
  const router = useRouter();
  const [highlightSeg, setHighlightSeg] = useState<number | undefined>(initialSeg);
  const [pipeline, setPipeline] = useState<{ phase: "idle" | "running" | "error"; step?: string; message?: string }>({
    phase: "idle",
  });

  const processAudio = async (blob: Blob, filename: string) => {
    setPipeline({ phase: "running", step: "uploading audio" });
    try {
      const form = new FormData();
      form.append("audio", new File([blob], filename, { type: blob.type }));
      setPipeline({ phase: "running", step: "transcribing → drafting follow-up → validating" });
      const res = await fetch(`/api/meetings/${meetingId}/audio`, { method: "POST", body: form });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPipeline({ phase: "idle" });
      router.refresh();
    } catch (e) {
      setPipeline({ phase: "error", message: e instanceof Error ? e.message : "pipeline failed" });
    }
  };

  const followupDraft = pendingApprovals.find((a) => a.kind === "email_draft");
  const oppUpdates = pendingApprovals.filter((a) => a.kind === "opportunity_update");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader n="01" title={transcript?.segments ? "Recording" : "Record this meeting"} />
          <div className="p-4">
            {transcript?.audioBlobUrl ? (
              <audio controls src={transcript.audioBlobUrl} className="w-full" preload="none" />
            ) : null}
            {!transcript?.summary ? (
              <div className="mt-3">
                <Recorder onComplete={processAudio} disabled={pipeline.phase === "running"} />
              </div>
            ) : null}
            {pipeline.phase === "running" ? (
              <p className="mt-3 font-mono text-[11px] text-accent status-running">▸ {pipeline.step}…</p>
            ) : pipeline.phase === "error" ? (
              <p className="mt-3 font-mono text-[11px] text-danger">✗ {pipeline.message}</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader n="02" title="Transcript" />
          <div className="max-h-[520px] overflow-y-auto p-3">
            {transcript?.segments?.length ? (
              <TranscriptView segments={transcript.segments} highlightSegment={highlightSeg} />
            ) : (
              <p className="px-2 py-4 text-[12px] text-ink-muted">
                No transcript yet — record on your phone or upload a file, and diarized segments land here.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader n="03" title="Summary" right={<Sparkles className="h-3.5 w-3.5 text-ink-faint" />} />
          <div className="p-4">
            {transcript?.summary ? (
              <ul className="space-y-1.5">
                {transcript.summary.split("\n").map((line, i) => (
                  <li key={i} className="text-[13px] leading-relaxed">
                    · {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-ink-muted">The follow-up agent summarizes the meeting after processing.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader n="04" title="Action items" right={<ListChecks className="h-3.5 w-3.5 text-ink-faint" />} />
          <div className="p-4">
            {transcript?.actionItems?.length ? (
              <ul className="space-y-2">
                {transcript.actionItems.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1">
                      {a.text}
                      <span className="ml-1.5 font-mono text-[10px] text-ink-faint">
                        {a.owner}
                        {a.dueHint ? ` · ${a.dueHint}` : ""}
                      </span>
                      {a.segmentRefs?.length ? (
                        <button
                          type="button"
                          onClick={() => setHighlightSeg(a.segmentRefs[0])}
                          className="ml-1.5 font-mono text-[10px] text-accent hover:opacity-80"
                        >
                          seg {a.segmentRefs.join(",")}
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-ink-muted">Extracted action items appear here with segment citations.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader n="05" title="CRM deltas & follow-up" />
          <div className="space-y-3 p-4">
            {oppUpdates.length > 0 ? (
              <div>
                <p className="text-[12px] text-ink-muted">
                  {oppUpdates.length} opportunity update{oppUpdates.length === 1 ? "" : "s"} proposed — review in the
                  queue:
                </p>
                {oppUpdates.map((a) => (
                  <Link
                    key={a.id}
                    href={`/approvals?id=${a.id}`}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-line bg-surface2 px-2.5 py-1.5 text-[12px] text-accent hover:border-accent"
                  >
                    Opportunity update <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            ) : null}
            {followupDraft ? (
              <Link
                href={`/approvals?id=${followupDraft.id}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-ink hover:opacity-90"
              >
                Review follow-up draft <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : transcript?.summary ? (
              <p className="text-[12px] text-ink-muted">Follow-up resolved — see the audit trail.</p>
            ) : (
              <p className="text-[12px] text-ink-muted">
                After processing, the follow-up draft (with the right PDS attachments and live pricing) lands in
                Approvals — cleared from the truck.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
