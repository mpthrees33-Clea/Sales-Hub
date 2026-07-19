/** Reset day (WO-13 task 6) — authenticated; restores the Tue-6:55-AM state via the seed engine. */
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { resetDay } from "@/lib/demo-control";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  await resetDay(userId);
  return NextResponse.json({ ok: true });
}
