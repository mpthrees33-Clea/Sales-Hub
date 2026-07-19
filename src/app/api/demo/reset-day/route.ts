/**
 * Reset day (WO-13 task 6) — the server-side equivalent of
 * `pnpm seed --reset-day`: the deterministic truncate+reseed IS the film-day
 * reset. Restores Tue 6:55 AM, the unprocessed Monday batch, an empty
 * approval queue, and the identical 8-week history. Session required
 * (middleware); audit-logged.
 */
import { NextResponse } from "next/server";
import { runSeed } from "@/db/seed";
import { audit } from "@/lib/audit";
import { REP } from "@/lib/rep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const result = await runSeed({ resetDay: true });
  // runSeed truncates audit_log, so the action lands AFTER the reset.
  await audit({ actor: `user:${REP.id}`, action: "demo.reset_day.control", detail: { elapsedMs: result.elapsedMs } });
  if (!result.ok) {
    return NextResponse.json({ status: "failed", error: "consistency check failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "reset", elapsedMs: result.elapsedMs });
}
