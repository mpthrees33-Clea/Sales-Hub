/**
 * Simulate Overnight (WO-08 task 4) — authenticated. Runs the SAME nightly
 * workflow with trigger 'simulate' against the demo clock. This is the filmed
 * (and in-person sales) trick: run the night on demand.
 */
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { nightlyRun } from "@/app/api/workflows/nightly";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const result = await nightlyRun({ trigger: "simulate" });
  return NextResponse.json(result);
}
