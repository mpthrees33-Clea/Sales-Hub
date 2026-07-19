/** startMeetingPipeline() — headless entrypoint (WO-08 contract, WO-07 task 9). */
import { meetingPipeline, type MeetingPipelineResult } from "./workflow";

export async function startMeetingPipeline(input: {
  meetingId: string;
  audioBlobUrl: string;
  trigger?: "nightly" | "user" | "workflow";
  workflowRunId?: string;
}): Promise<MeetingPipelineResult> {
  return meetingPipeline(input.meetingId, input.audioBlobUrl, {
    trigger: input.trigger ?? "workflow",
    workflowRunId: input.workflowRunId,
  });
}
