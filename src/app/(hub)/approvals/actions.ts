"use server";

/**
 * Approval resolution server actions (WO-03 task 9). Thin wrappers that add the
 * request-context concerns — auth + cache revalidation — around the pure core
 * in src/lib/approvals/resolve.ts. Resolution is unreachable by any agent tool;
 * these are the only externally-callable entry points, and they require a
 * session. The policy gate re-runs inside the core at execution time.
 */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { resolveApprovalCore, type ResolveInput, type ResolveResult } from "@/lib/approvals/resolve";

function revalidate(): void {
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/approvals/audit");
}

export async function resolveApproval(input: ResolveInput): Promise<ResolveResult> {
  const { userId } = await requireSession();
  const result = await resolveApprovalCore(input, userId);
  revalidate();
  return result;
}

export type BatchResult = {
  approved: number;
  blocked: { id: string; rule: string; reason: string }[];
  expired: number;
  errors: number;
};

export async function resolveApprovalsBatch(ids: string[]): Promise<BatchResult> {
  const { userId } = await requireSession();
  const summary: BatchResult = { approved: 0, blocked: [], expired: 0, errors: 0 };
  // Per-item gate runs (batch=true); one block does not halt the rest.
  for (const id of ids) {
    const r = await resolveApprovalCore({ id, resolution: "approve", batch: true }, userId);
    if (r.outcome === "approved") summary.approved++;
    else if (r.outcome === "blocked") summary.blocked.push({ id, rule: r.rule, reason: r.reason });
    else if (r.outcome === "expired") summary.expired++;
    else summary.errors++;
  }
  revalidate();
  return summary;
}
