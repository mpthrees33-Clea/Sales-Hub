"use server";

/** Demo-control server actions (WO-13 task 6) — auth-gated, audit-logged. */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { nightlyRun } from "@/app/api/workflows/nightly";
import { jumpToAfternoon, resetDay, toggleDemoChip } from "@/lib/demo-control";

export async function resetDayAction(): Promise<{ ok: true }> {
  const { userId } = await requireSession();
  const r = await resetDay(userId);
  revalidatePath("/", "layout");
  return r;
}

export async function simulateOvernightAction(): Promise<{ triaged?: number; processed?: number; note?: string }> {
  await requireSession();
  const r = await nightlyRun({ trigger: "simulate" });
  revalidatePath("/", "layout");
  return { triaged: r.triaged, processed: r.processed, note: r.note };
}

export async function jumpClockAction(): Promise<{ demoNow: string }> {
  const { userId } = await requireSession();
  const r = await jumpToAfternoon(userId);
  revalidatePath("/", "layout");
  return { demoNow: r.demoNow };
}

export async function toggleChipAction(): Promise<{ showDemoChip: boolean }> {
  const { userId } = await requireSession();
  const r = await toggleDemoChip(userId);
  revalidatePath("/", "layout");
  return r;
}
