/**
 * Interactive agent invocation (docs/01 §3): POST /api/agents/[agent] with a
 * JSON input body. Streams run progress as NDJSON events (step, result), so
 * every live agent surface can show real progress. Session required
 * (middleware).
 */
import type { NextRequest } from "next/server";
import { getAgent } from "@/agents";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest, ctx: { params: Promise<{ agent: string }> }) {
  const { agent: agentName } = await ctx.params;
  let agent;
  try {
    agent = getAgent(agentName);
  } catch {
    return Response.json({ error: `unknown agent: ${agentName}` }, { status: 404 });
  }
  const input = await req.json().catch(() => ({}));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await agent.run(input, {
          trigger: "user",
          onStep: (e) => emit({ type: "step", ...e }),
        });
        emit({ type: "result", ...result });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}
