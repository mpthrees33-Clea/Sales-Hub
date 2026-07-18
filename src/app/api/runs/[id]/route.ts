/** Run detail + ordered steps for the RunTrace drawer. */
import { NextResponse } from "next/server";
import { runTrace } from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await runTrace(id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
