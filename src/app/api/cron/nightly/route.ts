/**
 * Nightly cron entry (WO-08 task 3). Vercel Cron hits this at 0 5 * * * UTC.
 * Rejects unauthenticated calls: Vercel sends its own cron header, and a shared
 * CRON_SECRET (docs/02 §5) gates non-Vercel invocation. Not in the middleware
 * PROTECTED list — it guards itself here.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { nightlyRun } from "@/app/api/workflows/nightly";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") != null;
  const auth = req.headers.get("authorization");
  const secretOk = env.CRON_SECRET.length > 0 && auth === `Bearer ${env.CRON_SECRET}`;
  if (!isVercelCron && !secretOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await nightlyRun({ trigger: "cron" });
  return NextResponse.json(result);
}
