"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  assembleSubmittalPackage,
  proposeSubmittalComposition,
  type AssemblePackageResult,
  type ProposeResult,
} from "@/lib/submittals";

/** Builder step 1: the agent proposes the composition (approval created). */
export async function proposeSubmittal(input: {
  projectId: string;
  productIds: string[];
  sourceEmailId?: string;
}): Promise<ProposeResult> {
  await requireSession();
  return proposeSubmittalComposition({ ...input, trigger: "user" });
}

/** Builder step 2: deterministic assembly of the reviewed composition. */
export async function assembleSubmittal(input: {
  approvalId: string;
  composition: unknown;
  sourceEmailId?: string;
  packageId?: string;
}): Promise<AssemblePackageResult> {
  const session = await requireSession();
  const result = await assembleSubmittalPackage({ ...input, actor: `user:${session.userId}` });
  revalidatePath("/submittals");
  revalidatePath("/approvals");
  return result;
}
