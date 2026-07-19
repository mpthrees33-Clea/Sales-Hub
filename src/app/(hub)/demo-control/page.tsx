/**
 * Hidden film-day control panel (WO-13 task 6). Authenticated (the (hub) layout
 * + middleware require a session), absent from the nav rail, noindex. Four
 * audit-logged actions drive a deterministic demo: reset, simulate overnight,
 * jump clock, toggle the DEMO chip.
 */
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { getDemoStateRow } from "@/lib/demo-clock";
import { formatDemoClock } from "@/lib/dates";
import { DemoControlPanel } from "./panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo Control", robots: { index: false, follow: false } };

export default async function Page() {
  await requireSession();
  const state = await getDemoStateRow();
  return <DemoControlPanel clockLabel={formatDemoClock(state.demoNow)} showChip={state.showDemoChip} />;
}
