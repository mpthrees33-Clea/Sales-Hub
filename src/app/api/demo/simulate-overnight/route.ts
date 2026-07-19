/**
 * Simulate Overnight (WO-08 task 4): invokes the REAL nightly workflow with
 * trigger 'simulate' against the demo clock — the same run Cron fires at
 * 5 AM. Session required (middleware). This is what gets filmed.
 */
import { NextResponse } from "next/server";
import { nightlyRun } from "@/app/api/workflows/nightly";
import { audit } from "@/lib/audit";
import { REP } from "@/lib/rep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  await audit({ actor: `user:${REP.id}`, action: "demo.simulate_overnight.started" });
  const result = await nightlyRun({ trigger: "simulate" });
  if (result.status === "noop") {
    return NextResponse.json({ status: "noop", message: result.reason });
  }
  return NextResponse.json(result);
}
