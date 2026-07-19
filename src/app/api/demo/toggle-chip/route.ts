/**
 * Toggle the "DEMO • Tue 6:55 AM" top-bar chip for filming takes (WO-13
 * task 6). Persisted in demo_state; session required (middleware);
 * audit-logged.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { demoState } from "@/db/schema";
import { audit } from "@/lib/audit";
import { REP } from "@/lib/rep";

export const dynamic = "force-dynamic";

export async function POST() {
  const state = await db.query.demoState.findFirst({ where: eq(demoState.id, 1) });
  if (!state) return NextResponse.json({ error: "demo_state missing — run pnpm seed" }, { status: 500 });
  const next = !state.showDemoChip;
  await db.update(demoState).set({ showDemoChip: next }).where(eq(demoState.id, 1));
  await audit({ actor: `user:${REP.id}`, action: "demo.toggle_chip", detail: { showDemoChip: next } });
  return NextResponse.json({ status: "toggled", showDemoChip: next });
}
