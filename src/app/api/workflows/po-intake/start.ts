/**
 * startPoIntake() — the contract WO-04 triage and WO-08's nightly fan-out
 * call for `triage: 'po'` routings with PDF attachments (WO-06 task 14a).
 */
import { poIntake, type PoIntakeResult } from "./workflow";

export async function startPoIntake(input: {
  blobUrl: string;
  sourceEmailId?: string;
  trigger?: "nightly" | "user" | "workflow";
  workflowRunId?: string;
}): Promise<PoIntakeResult> {
  return poIntake(input.blobUrl, input.sourceEmailId, {
    trigger: input.trigger ?? "workflow",
    workflowRunId: input.workflowRunId,
  });
}
