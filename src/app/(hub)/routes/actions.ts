"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getOrComputeTodayRoute, type RouteVariantOpts } from "@/lib/routes";

/** Explicit recompute (WO-12 task 4) — refreshes the cache row and audit-logs. */
export async function recomputeTodayRoute(opts: RouteVariantOpts): Promise<{ ok: boolean }> {
  const session = await requireSession();
  await getOrComputeTodayRoute({ ...opts, forceRecompute: true, actor: `user:${session.userId}` });
  revalidatePath("/routes");
  revalidatePath("/dashboard");
  return { ok: true };
}
