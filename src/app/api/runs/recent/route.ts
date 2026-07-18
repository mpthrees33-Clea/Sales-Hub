/** Shared poll source for the agent ticker and the dashboard runs panel. */
import { desc } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { agentRuns } from "@/db/schema";
import { formatDurationMs } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20);
  const rows = await db
    .select({
      id: agentRuns.id,
      agentName: agentRuns.agentName,
      status: agentRuns.status,
      trigger: agentRuns.trigger,
      model: agentRuns.model,
      costUsd: agentRuns.costUsd,
      startedAt: agentRuns.startedAt,
      finishedAt: agentRuns.finishedAt,
      output: agentRuns.output,
    })
    .from(agentRuns)
    .orderBy(desc(agentRuns.startedAt))
    .limit(limit);

  const runs = rows.map((r) => {
    const elapsed = r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : Date.now() - r.startedAt.getTime();
    const verb =
      r.status === "running"
        ? "running"
        : r.status === "succeeded"
          ? "done"
          : r.status === "escalated"
            ? "escalated"
            : "failed";
    return {
      id: r.id,
      agentName: r.agentName,
      status: r.status,
      trigger: r.trigger,
      model: r.model,
      costUsd: r.costUsd,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      elapsedMs: elapsed,
      summary: `${r.agentName} · ${verb} · ${formatDurationMs(elapsed)}`,
    };
  });
  return NextResponse.json({ runs });
}
