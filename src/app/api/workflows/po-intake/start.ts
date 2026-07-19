/**
 * PO Intake entry points (WO-06 task 14). `startPoIntake` is the contract WO-04
 * triage and WO-08's nightly fan-out call for `triage:'po'` threads with PDF
 * attachments; `startPoIntakeFromRouting` claims the routing first (idempotent).
 */
import { poIntake, type PoIntakeResult } from "./workflow";
import { claimRoutingById, completeRouting, releaseRouting } from "@/lib/routing";

export async function startPoIntake(opts: { blobUrl: string; sourceEmailId?: string }): Promise<PoIntakeResult> {
  return poIntake(opts.blobUrl, opts.sourceEmailId);
}

export async function startPoIntakeFromRouting(routingId: string): Promise<PoIntakeResult | { status: "skipped" }> {
  const claimed = await claimRoutingById(routingId);
  if (!claimed) return { status: "skipped" };
  const payload = (claimed.payload ?? {}) as { attachmentBlobUrl?: string };
  if (!payload.attachmentBlobUrl) {
    await completeRouting(routingId, "");
    return { status: "skipped" };
  }
  try {
    const result = await startPoIntake({ blobUrl: payload.attachmentBlobUrl, sourceEmailId: claimed.emailId });
    await completeRouting(routingId, result.runId ?? "");
    return result;
  } catch (err) {
    await releaseRouting(routingId);
    throw err;
  }
}
