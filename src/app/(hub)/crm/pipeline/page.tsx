import Link from "next/link";
import { Card } from "@/components/ui";
import { pipelineByStage } from "@/lib/queries/crm";
import { STAGE_LABEL } from "@/lib/crm-stages";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const cols = await pipelineByStage();

  return (
    <div className="mx-auto max-w-full space-y-4">
      <div className="flex items-baseline gap-4">
        <h1 className="text-lg font-semibold tracking-tight">CRM</h1>
        <nav className="flex gap-1 font-mono text-[11px]">
          <Link href="/crm" className="rounded-full border border-line px-2.5 py-1 text-ink-muted hover:text-ink">
            accounts
          </Link>
          <span className="rounded-full border border-accent px-2.5 py-1 text-accent">pipeline</span>
        </nav>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {cols.map((col) => (
          <div key={col.stage} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[12px] font-medium">{STAGE_LABEL[col.stage]}</span>
              <span className="font-mono text-[10px] text-ink-faint">
                {col.opps.length} · {formatCents(col.totalCents, { compact: true })}
              </span>
            </div>
            <div className="space-y-2">
              {col.opps.map((o) => (
                <Link key={o.id} href={`/crm/${o.accountId}`} className="block">
                  <Card className="px-3 py-2.5 transition-colors hover:border-line-strong">
                    <p className="text-[12px] font-medium leading-snug">{o.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{o.accountName}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-ink">{formatCents(o.valueCents, { compact: true })}</span>
                      <span className="font-mono text-[10px] text-ink-faint">{o.probability}%</span>
                    </div>
                    {o.nextStep ? <p className="mt-1 truncate font-mono text-[9px] text-ink-faint">next: {o.nextStep}</p> : null}
                  </Card>
                </Link>
              ))}
              {col.opps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center font-mono text-[10px] text-ink-faint">
                  empty
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
