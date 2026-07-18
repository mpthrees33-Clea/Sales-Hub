import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals } from "@/db/schema";
import { getDemoStateRow } from "@/lib/demo-clock";
import { formatDemoClock } from "@/lib/dates";
import { REP } from "@/lib/rep";
import { AgentTicker } from "@/components/agent-ticker";
import { Rail } from "@/components/shell/rail";
import { TopBar } from "@/components/shell/topbar";

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  let pendingCount = 0;
  let clockLabel = "—";
  let showChip = true;
  try {
    const [state, [pending]] = await Promise.all([
      getDemoStateRow(),
      db.select({ n: count() }).from(approvals).where(eq(approvals.status, "pending")),
    ]);
    clockLabel = formatDemoClock(state.demoNow);
    showChip = state.showDemoChip;
    pendingCount = pending?.n ?? 0;
  } catch {
    // pre-seed: shell still renders
  }

  return (
    <div className="flex min-h-screen">
      <Rail pendingApprovals={pendingCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar clockLabel={clockLabel} showChip={showChip} repName={REP.name} />
        <AgentTicker />
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
