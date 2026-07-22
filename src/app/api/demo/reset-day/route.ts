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
import { usingLocalBlobStore } from "@/lib/env";
import { REP } from "@/lib/rep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  // Surfaced so the film-day reset can't silently write files to throwaway
  // local storage on Vercel (no BLOB_READ_WRITE_TOKEN) — the caller sees it.
  const blobStore = usingLocalBlobStore ? "local" : "vercel";
  const result = await runSeed({ resetDay: true });
  // runSeed truncates audit_log, so the action lands AFTER the reset.
  await audit({ actor: `user:${REP.id}`, action: "demo.reset_day.control", detail: { elapsedMs: result.elapsedMs, blobStore } });
  if (!result.ok) {
    return NextResponse.json({ status: "failed", error: "consistency check failed", blobStore }, { status: 500 });
  }
  return NextResponse.json({ status: "reset", elapsedMs: result.elapsedMs, blobStore });
}
