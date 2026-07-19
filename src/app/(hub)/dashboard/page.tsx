import { Suspense } from "react";
import { KpiTileSkeleton } from "@/components/kpi-tile";
import { Skeleton } from "@/components/ui";
import { ChangesFeed } from "./_components/changes-feed";
import { Docket } from "./_components/docket";
import { KpiRow } from "./_components/kpi-row";
import { OvernightBanner } from "./_components/overnight-banner";
import { RouteCard } from "@/components/route-card";
import { RunsPanel } from "./_components/runs-panel";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Mission Control</h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          Every answer shows its source
        </span>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTileSkeleton /> <KpiTileSkeleton /> <KpiTileSkeleton /> <KpiTileSkeleton />
          </div>
        }
      >
        <KpiRow />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <OvernightBanner />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
            <Docket />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
            <ChangesFeed />
          </Suspense>
        </div>
        <div className="space-y-4">
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
            <RouteCard />
          </Suspense>
          <RunsPanel initialOpenRunId={run} />
        </div>
      </div>
    </div>
  );
}
