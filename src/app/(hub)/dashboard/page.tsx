/**
 * Mission Control (WO-02). The "Rep wakes at 6:55am" opening surface and the
 * standing proof that every agent action is observable: KPIs vs targets, the
 * overnight brief, today's docket + route, the overnight-changes feed, and a
 * live agent-runs panel with step-level drill-in.
 *
 * Composition is RSC with per-panel Suspense skeletons; the docket is fetched
 * once per request (React cache) and shared by the docket and route panels.
 */
import { Suspense, cache } from "react";
import { KpiTile, KpiTileSkeleton } from "@/components/kpi-tile";
import { Card, CardHeader } from "@/components/ui";
import { kpis, todaysDocket } from "@/lib/queries/dashboard";
import { OvernightBanner } from "./_components/overnight-banner";
import { Docket, DocketSkeleton } from "./_components/docket";
import { RouteCard } from "@/components/route-card";
import { ChangesFeed, ChangesFeedSkeleton } from "./_components/changes-feed";
import { RunsPanel } from "./_components/runs-panel";
import { RunDrawer } from "./_components/run-drawer";

export const dynamic = "force-dynamic";

/** One docket read per request, shared by the docket and route panels. */
const getDocket = cache(() => todaysDocket());

async function KpiRow() {
  const k = await kpis();
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile label="Created · Week" valueCents={k.createdWk.valueCents} targetCents={k.createdWk.targetCents} deltaPct={k.createdWk.deltaPct} spark={k.createdWk.spark} />
      <KpiTile label="Created · Month" valueCents={k.createdMo.valueCents} targetCents={k.createdMo.targetCents} deltaPct={k.createdMo.deltaPct} spark={k.createdMo.spark} />
      <KpiTile label="Invoiced · Week" valueCents={k.invoicedWk.valueCents} targetCents={k.invoicedWk.targetCents} deltaPct={k.invoicedWk.deltaPct} spark={k.invoicedWk.spark} />
      <KpiTile label="Invoiced · Month" valueCents={k.invoicedMo.valueCents} targetCents={k.invoicedMo.targetCents} deltaPct={k.invoicedMo.deltaPct} spark={k.invoicedMo.spark} />
    </div>
  );
}

function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <KpiTileSkeleton key={i} />
      ))}
    </div>
  );
}

async function DocketPanel() {
  const items = await getDocket();
  return <Docket items={items} />;
}


function BannerSkeleton() {
  return (
    <Card className="p-4">
      <div className="skeleton h-12 w-full" />
    </Card>
  );
}

function RoutePanelSkeleton() {
  return (
    <Card>
      <CardHeader title="Route" n="03" />
      <div className="p-4">
        <div className="skeleton h-24 w-full" />
      </div>
    </Card>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Mission Control</h1>
        <span className="hidden font-mono text-[10px] text-ink-faint sm:block">Drafts only — humans send</span>
      </div>

      <Suspense fallback={<BannerSkeleton />}>
        <OvernightBanner />
      </Suspense>

      <Suspense fallback={<KpiRowSkeleton />}>
        <KpiRow />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Suspense fallback={<DocketSkeleton />}>
            <DocketPanel />
          </Suspense>
          <RunsPanel />
        </div>
        <div className="space-y-4">
          <Suspense fallback={<RoutePanelSkeleton />}>
            <RouteCard />
          </Suspense>
          <Suspense fallback={<ChangesFeedSkeleton />}>
            <ChangesFeed />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <RunDrawer />
      </Suspense>
    </div>
  );
}
