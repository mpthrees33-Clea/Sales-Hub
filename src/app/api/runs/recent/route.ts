/** Shared poll source for the agent ticker and the dashboard runs panel. */
import { NextResponse, type NextRequest } from "next/server";
import { recentRuns } from "@/lib/queries/dashboard";
import { formatDurationMs } from "@/lib/dates";

export const dynamic = "force-dynamic";

const VERB: Record<string, string> = {
  running: "running",
  succeeded: "done",
  escalated: "escalated",
  failed: "failed",
};

export async function GET(req: NextRequest) {
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20);
  const rows = await recentRuns(limit);
  const runs = rows.map((r) => ({
    id: r.id,
    agentName: r.agentName,
    trigger: r.trigger,
    status: r.status,
    model: r.model,
    costUsd: r.costUsd,
    elapsedMs: r.elapsedMs,
    summary: `${r.agentName} · ${VERB[r.status] ?? r.status} · ${formatDurationMs(r.elapsedMs)}`,
  }));
  return NextResponse.json({ runs });
}
