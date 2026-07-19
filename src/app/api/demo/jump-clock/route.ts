/**
 * Jump clock → post-meeting afternoon (WO-13 task 6): demo_now moves to Tue
 * ~4:15 PM, every Tuesday meeting that has ended is completed, the 9:30
 * Meridian walkthrough gets its transcript staged (demo transcription
 * fixture), and the Harborview follow-up artifacts are materialized through
 * the REAL meeting pipeline (idempotent) so beat 5 films without waiting.
 * Session required (middleware); audit-logged.
 */
import { and, eq, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { meetings, transcripts } from "@/db/schema";
import { et } from "@/db/seed/scenario";
import { sid } from "@/db/seed/ids";
import { audit } from "@/lib/audit";
import { setDemoNow, invalidateDemoClockCache } from "@/lib/demo-clock";
import { REP } from "@/lib/rep";
import { getTranscriptionProvider } from "@/providers";
import { startMeetingPipeline } from "@/app/api/workflows/transcribe/start";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AFTERNOON = et("2026-03-10T16:15");
const AUDIO_FIXTURE = "/api/blob/fixtures/harborview-walk.wav";

export async function POST() {
  await setDemoNow(AFTERNOON);
  invalidateDemoClockCache();

  // Every Tuesday meeting that has ended by 4:15 PM is now completed.
  const completed = await db
    .update(meetings)
    .set({ status: "completed" })
    .where(and(eq(meetings.status, "scheduled"), lte(meetings.endsAt, AFTERNOON)))
    .returning({ id: meetings.id, title: meetings.title });

  // Stage the 9:30 walkthrough's transcript (demo provider serves the
  // diarized fixture instantly — nothing generates on camera).
  const meridianId = sid("meeting:mtg-stonebridge-tue");
  const { segments } = await getTranscriptionProvider().transcribe(AUDIO_FIXTURE);
  await db
    .insert(transcripts)
    .values({ meetingId: meridianId, audioBlobUrl: AUDIO_FIXTURE, segments })
    .onConflictDoUpdate({ target: transcripts.meetingId, set: { audioBlobUrl: AUDIO_FIXTURE, segments } });

  // Follow-up artifacts: run the real pipeline for the site walk whose demo
  // fixtures ground it (no-op when the overnight run already materialized it).
  const harborviewId = sid("meeting:mtg-harborview-walk");
  const existing = await db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, harborviewId) });
  let followup = "already_materialized";
  if (!existing?.summary) {
    const res = await startMeetingPipeline({
      meetingId: harborviewId,
      audioBlobUrl: existing?.audioBlobUrl ?? AUDIO_FIXTURE,
      trigger: "user",
    });
    followup = res.status;
  }

  await audit({
    actor: `user:${REP.id}`,
    action: "demo.jump_clock",
    detail: {
      demoNow: AFTERNOON.toISOString(),
      meetingsCompleted: completed.map((m) => m.title),
      followup,
    },
  });
  return NextResponse.json({
    status: "jumped",
    demoNow: AFTERNOON.toISOString(),
    meetingsCompleted: completed.length,
    followup,
  });
}
