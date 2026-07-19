/**
 * Leave-by lookup for docket surfaces (dashboard, meetings). Reads through
 * the cached day route — the first call of a demo-day computes it, every
 * later render is a cache read.
 */
import { getOrComputeTodayRoute } from "@/lib/routes";

export type LeaveByInfo = { leaveBy: Date; tight: boolean; tooltip: string };

export async function leaveBysForToday(): Promise<Map<string, LeaveByInfo>> {
  const route = await getOrComputeTodayRoute().catch(() => null);
  if (!route) return new Map();
  return new Map(
    Object.entries(route.leaveBys).map(([meetingId, lb]) => [
      meetingId,
      { leaveBy: new Date(lb.leaveBy), tight: lb.tight, tooltip: lb.tooltip },
    ]),
  );
}
