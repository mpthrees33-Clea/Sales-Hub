import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, demoState } from "@/db/schema";
import { Card, CardHeader, Mono } from "@/components/ui";
import { formatDemoClock } from "@/lib/dates";
import { DemoControlClient } from "./control-client";

export const dynamic = "force-dynamic";

/** Hidden film-day panel (WO-13 task 6): session required, not in the rail. */
export const metadata: Metadata = {
  title: "Demo control",
  robots: { index: false, follow: false },
};

export default async function DemoControlPage() {
  const [state, pending] = await Promise.all([
    db.query.demoState.findFirst({ where: eq(demoState.id, 1) }),
    db.select({ n: count() }).from(approvals).where(eq(approvals.status, "pending")),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Demo control</h1>
        <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
          film-day panel · every action audit-logged · determinism is the brand
        </p>
      </div>

      <Card>
        <CardHeader n="00" title="Current state" />
        <dl className="grid grid-cols-2 gap-2 p-4 text-[12px] sm:grid-cols-4">
          <StateCell k="Demo clock" v={state ? formatDemoClock(state.demoNow) : "—"} />
          <StateCell k="DEMO chip" v={state?.showDemoChip ? "visible" : "hidden"} />
          <StateCell k="Nightly ran" v={state?.lastNightlyRunAt ? "yes" : "not yet"} />
          <StateCell k="Pending approvals" v={String(pending[0]?.n ?? 0)} />
        </dl>
      </Card>

      <DemoControlClient />
    </div>
  );
}

function StateCell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{k}</dt>
      <dd className="mt-0.5">
        <Mono className="text-[12px]">{v}</Mono>
      </dd>
    </div>
  );
}
