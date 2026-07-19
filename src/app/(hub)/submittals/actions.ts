"use server";

/** Submittal builder action (WO-14 task 5) — run the agent, surface escalation. */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { submittalAgent } from "@/agents/submittal";

export type SubmittalRunResult = {
  status: "succeeded" | "escalated" | "failed";
  approvalId?: string;
  escalation?: { reason: string; detail: Record<string, unknown> };
};

export async function runSubmittalAction(projectId: string, productIds: string[]): Promise<SubmittalRunResult> {
  await requireSession();
  const run = await submittalAgent.run({ projectId, productIds }, { trigger: "user" });
  revalidatePath("/submittals");
  revalidatePath("/approvals");
  return { status: run.status, approvalId: run.approvalIds[0], escalation: run.escalation };
}
