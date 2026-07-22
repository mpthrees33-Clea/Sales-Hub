import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { crmSummary, listAccounts } from "@/lib/queries/crm";
import { formatCents } from "@/lib/money";
import { relativeAge } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPES = ["all", "gc", "architect", "designer", "distributor", "owner"] as const;

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { type = "all", q } = await searchParams;
  const [rows, summary, demoNow] = await Promise.all([listAccounts({ type, q }), crmSummary(), getDemoNow()]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-4">
          <h1 className="text-lg font-semibold tracking-tight">CRM</h1>
          <nav className="flex gap-1 font-mono text-[11px]">
            <span className="rounded-full border border-accent px-2.5 py-1 text-accent">accounts</span>
            <Link href="/crm/pipeline" className="rounded-full border border-line px-2.5 py-1 text-ink-muted hover:text-ink">
              pipeline
            </Link>
          </nav>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Open pipeline" value={formatCents(summary.pipelineCents, { compact: true })} />
        <SummaryTile label="Open opportunities" value={String(summary.openOpps)} />
        <SummaryTile label="Accounts" value={String(summary.accounts)} />
        <SummaryTile label="Won (all-time)" value={formatCents(summary.wonCents, { compact: true })} />
      </div>

      <Card>
        <CardHeader
          n="01"
          title="Accounts"
          right={
            <form>
              <input type="hidden" name="type" value={type} />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search accounts…"
                className="rounded-md border border-line bg-surface px-2.5 py-1 text-[12px] outline-none focus:border-accent"
              />
            </form>
          }
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
          {TYPES.map((t) => (
            <Link
              key={t}
              href={`/crm?type=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px]",
                type === t ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              {t}
            </Link>
          ))}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Building2} title="No accounts" copy="No accounts match this filter." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id}>
                <Link href={`/crm/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{a.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                      {a.type} · {a.city}, {a.state} · {a.tier} tier
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[12px] text-ink">{formatCents(a.pipelineCents, { compact: true })}</p>
                    <p className="font-mono text-[10px] text-ink-faint">{a.openCount} open</p>
                  </div>
                  <span className="w-16 text-right font-mono text-[10px] text-ink-faint">
                    {a.lastActivityAt ? relativeAge(a.lastActivityAt, demoNow) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </Card>
  );
}
