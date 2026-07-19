"use server";

/**
 * Approval resolution server actions (WO-03 task 9). Thin wrappers that add the
 * request-context concerns — auth + cache revalidation — around the pure,
 * context-free core in src/lib/approvals/resolve.ts. Resolution is unreachable
 * by any agent tool; these are the only externally-callable entry points and
 * they require a session. The policy gate re-runs inside the core at execution
 * time against the resolved (possibly human-edited) payload; rejecting never
 * executes.
 */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { resolveApprovalCore, type ResolveInput } from "@/lib/approvals/resolve";

export type { ResolveResult } from "@/lib/approvals/resolve";

function revalidate(): void {
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/approvals/audit");
}

export async function resolveApproval(input: ResolveInput) {
  const { userId } = await requireSession();
  const result = await resolveApprovalCore(input, userId);
  revalidate();
  return result;
}

/**
 * Batch approve — low tier ONLY, enforced server-side (the gate re-runs per
 * item with batch context; one block does not halt the rest).
 */
export async function resolveApprovalsBatch(ids: string[]): Promise<{
  approved: number;
  blocked: number;
  errors: number;
}> {
  const { userId } = await requireSession();
  let approved = 0;
  let blocked = 0;
  let errors = 0;
  for (const id of ids) {
    const res = await resolveApprovalCore({ id, resolution: "approve", batch: true }, userId);
    if (res.outcome === "approved") approved += 1;
    else if (res.outcome === "blocked") blocked += 1;
    else errors += 1;
  }
  revalidate();
  return { approved, blocked, errors };
}
