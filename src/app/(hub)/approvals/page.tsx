import Link from "next/link";
import { attachableAssetOptions, pendingQueue } from "@/lib/queries/approvals";
import { ApprovalsClient } from "./_components/approvals-client";
import { WhyPopover } from "./_components/why-popover";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const [{ queue, demoNow }, assetOptions] = await Promise.all([pendingQueue(), attachableAssetOptions()]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Approvals</h1>
          <span className="font-mono text-[11px] text-ink-muted">
            {queue.length} pending · Human handoff built in · Drafts only — humans send
          </span>
        </div>
        <div className="flex items-center gap-4">
          <WhyPopover />
          <Link href="/approvals/audit" className="font-mono text-[10px] text-ink-faint hover:text-ink-muted">
            Audit trail →
          </Link>
        </div>
      </div>
      <ApprovalsClient initialQueue={queue} demoNow={demoNow} assetOptions={assetOptions} initialSelectedId={id} />
    </div>
  );
}
