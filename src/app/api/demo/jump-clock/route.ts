/** Jump clock (WO-13 task 6) — authenticated; advances to the post-meeting afternoon. */
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { jumpToAfternoon } from "@/lib/demo-control";

export const dynamic = "force-dynamic";

export async function POST() {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const r = await jumpToAfternoon(userId);
  return NextResponse.json(r);
}
