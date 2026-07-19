"use server";

/** Meeting processing (WO-07) — run the pipeline; approvals are the deliverable. */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { startMeetingPipeline } from "@/app/api/workflows/transcribe/start";

export async function processMeetingAction(meetingId: string): Promise<{ status: string; approvals: number }> {
  await requireSession();
  const r = await startMeetingPipeline({ meetingId });
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  return { status: r.status, approvals: r.approvalIds.length };
}
