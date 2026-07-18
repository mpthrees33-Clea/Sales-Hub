/**
 * Leave-by lookup for docket surfaces. WO-12 implements this over the
 * computed day route; until then every meeting gets the placeholder shell.
 */
export type LeaveByInfo = { leaveBy: Date; tight: boolean; tooltip: string };

export async function leaveBysForToday(): Promise<Map<string, LeaveByInfo>> {
  // TODO(WO-12): populate from getOrComputeTodayRoute() leave-by math.
  return new Map();
}
