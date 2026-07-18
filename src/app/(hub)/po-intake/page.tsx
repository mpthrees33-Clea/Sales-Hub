import Link from "next/link";
import { desc } from "drizzle-orm";
import { ScanText } from "lucide-react";
import { db } from "@/db/client";
import { accounts, purchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardHeader, EmptyState, Mono, StatusPill } from "@/components/ui";
import { formatCentsExact } from "@/lib/money";
import { formatDurationMs, relativeAge } from "@/lib/dates";
import { getDemoNow } from "@/lib/demo-clock";
import { Dropzone } from "./_components/dropzone";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  received: "muted",
  extracted: "accent",
  validated: "ok",
  converted: "ok",
  escalated: "warn",
} as const;

export default async function PoIntakePage() {
  const [rows, demoNow] = await Promise.all([
    db
      .select({ po: purchaseOrders, accountName: accounts.name })
      .from(purchaseOrders)
      .leftJoin(accounts, eq(accounts.id, purchaseOrders.accountId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(50),
    getDemoNow(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">PO Intake</h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          Grounded or it escalates
        </span>
      </div>

      <Dropzone />

      <Card>
        <CardHeader n="01" title="Purchase orders" />
        {rows.length === 0 ? (
          <EmptyState
            icon={ScanText}
            title="No purchase orders yet"
            copy="Drop a PO PDF above, or let the overnight run process inbound PO emails. One grounded extraction, seven deterministic validation layers, a draft sales order in under a minute."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-3 py-2">PO #</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Layers</th>
                  <th className="px-3 py-2 text-right">Elapsed</th>
                  <th className="px-3 py-2 text-right">Age</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ po, accountName }) => {
                  const totals = (po.extracted as { totals?: { total_cents?: number } } | null)?.totals;
                  const failed = (po.validation ?? []).filter((v) => !v.pass);
                  const layerSummary =
                    po.validation == null
                      ? "—"
                      : failed.length === 0
                        ? "7/7"
                        : `failed L${failed[0]!.layer}`;
                  return (
                    <tr key={po.id} className="border-b border-line last:border-0 hover:bg-surface2/50">
                      <td className="px-3 py-2">
                        <Link href={`/po-intake/${po.id}`} className="font-mono text-[12px] text-accent hover:opacity-80">
                          {po.customerPoNumber ?? po.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{accountName ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {totals?.total_cents ? formatCentsExact(totals.total_cents) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill tone={STATUS_TONE[po.status]}>{po.status}</StatusPill>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        <span className={failed.length > 0 ? "text-danger" : "text-ok"}>{layerSummary}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-ink-muted">
                        {po.elapsedMs ? formatDurationMs(po.elapsedMs) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[10px] text-ink-faint">
                        {relativeAge(po.createdAt, demoNow)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
        The model only extracts · seven deterministic layers validate · humans approve. Every extracted field is
        page-anchored to the source PDF — <Mono>every answer shows its source</Mono>.
      </p>
    </div>
  );
}
