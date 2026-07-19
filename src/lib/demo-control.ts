/**
 * Demo-control operations (WO-13 task 6) — the film-day panel + API routes both
 * call these. Every action is audit-logged. Reset goes through the seed engine
 * (the one source of the deterministic Tue-6:55-AM state); nothing here mutates
 * seed-owned tables by a bespoke path.
 */
import { execSync } from "node:child_process";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { demoState, meetings } from "@/db/schema";
import { audit } from "@/lib/audit";
import { dayBounds } from "@/lib/dates";
import { getDemoStateRow, invalidateDemoClockCache, setDemoNow } from "@/lib/demo-clock";

/** Post-meeting afternoon: Tue 2026-03-10 4:15 PM ET (20:15 UTC, EDT). */
const AFTERNOON = new Date(Date.UTC(2026, 2, 10, 20, 15));

/** Re-seed the deterministic film-day state (equivalent to `pnpm seed --reset-day`). */
export async function resetDay(userId: string): Promise<{ ok: true }> {
  execSync("pnpm seed --reset-day", { cwd: process.cwd(), stdio: "ignore" });
  invalidateDemoClockCache();
  await audit({ actor: `user:${userId}`, action: "demo.reset_day", objectType: "demo_state" });
  return { ok: true };
}

/**
 * Jump the demo clock to the post-meeting afternoon and complete the day's first
 * meeting so beat 5 (meeting follow-up) films without waiting. Coherent docket:
 * demo_now advances, the 9:30 stop reads completed.
 */
export async function jumpToAfternoon(userId: string): Promise<{ demoNow: string; completedMeetingId: string | null }> {
  await setDemoNow(AFTERNOON);
  const { start, end } = dayBounds(AFTERNOON);
  const [firstMeeting] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(gte(meetings.startsAt, start), lte(meetings.startsAt, end)))
    .orderBy(asc(meetings.startsAt))
    .limit(1);
  if (firstMeeting) {
    await db.update(meetings).set({ status: "completed" }).where(eq(meetings.id, firstMeeting.id));
  }
  await audit({ actor: `user:${userId}`, action: "demo.jump_clock", objectType: "demo_state", detail: { to: AFTERNOON.toISOString(), completedMeetingId: firstMeeting?.id ?? null } });
  return { demoNow: AFTERNOON.toISOString(), completedMeetingId: firstMeeting?.id ?? null };
}

/** Show/hide the "DEMO • …" top-bar chip for filming takes (persisted). */
export async function toggleDemoChip(userId: string): Promise<{ showDemoChip: boolean }> {
  const state = await getDemoStateRow();
  const next = !state.showDemoChip;
  await db.update(demoState).set({ showDemoChip: next }).where(eq(demoState.id, 1));
  await audit({ actor: `user:${userId}`, action: "demo.toggle_chip", objectType: "demo_state", detail: { showDemoChip: next } });
  return { showDemoChip: next };
}
