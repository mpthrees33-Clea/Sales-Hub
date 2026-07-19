/** Headless entry point for the meeting pipeline (WO-07 task 9; WO-08 contract). */
import { meetingPipeline, type MeetingPipelineResult } from "./workflow";

export async function startMeetingPipeline(opts: { meetingId: string; audioBlobUrl?: string }): Promise<MeetingPipelineResult> {
  return meetingPipeline(opts.meetingId, opts.audioBlobUrl);
}
