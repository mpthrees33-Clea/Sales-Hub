"use server";

/** Route recompute (WO-12 task 5) — force a fresh MapsProvider call + cache. */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { recomputeTodayRoute, type RouteConfig } from "@/lib/routes";

export async function recomputeRouteAction(cfg: RouteConfig): Promise<void> {
  const { userId } = await requireSession();
  await recomputeTodayRoute(cfg, userId);
  revalidatePath("/routes");
  revalidatePath("/dashboard");
}
