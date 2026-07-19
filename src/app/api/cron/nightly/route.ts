/**
 * Cron entrypoint (WO-08 task 3): Vercel Cron (vercel.json `0 5 * * *`) →
 * nightly workflow. Requires the Vercel cron authorization header
 * (Bearer CRON_SECRET) — unauthenticated invocation is rejected
 * (docs/02 §5). Not session-gated: machines call this, not the rep.
 */
import { NextResponse, type NextRequest } from "next/server";
import { nightlyRun } from "@/app/api/workflows/nightly";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await nightlyRun({ trigger: "cron" });
  return NextResponse.json(result);
}
