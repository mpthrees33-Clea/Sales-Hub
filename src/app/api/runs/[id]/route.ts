/** Single run + its ordered steps — backs the Mission Control run drawer. */
import { NextResponse } from "next/server";
import { runMeta, runTrace } from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [run, steps] = await Promise.all([runMeta(id), runTrace(id)]);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
  return NextResponse.json({ run, steps });
}
