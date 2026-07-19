/**
 * PO Intake list (WO-06 task 15) — the flagship module. Dropzone + a table of
 * POs with status, the seven-layer summary, and elapsed time. Grounded or it
 * escalates.
 */
import Link from "next/link";
import { ScanText } from "lucide-react";
import { Card, CardHeader, EmptyState, StatusPill } from "@/components/ui";
import { formatCentsExact } from "@/lib/money";
import { listPurchaseOrders } from "@/lib/queries/po-intake";
import { Dropzone } from "./_components/dropzone";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "accent" | "muted"> = {
  received: "muted",
  extracted: "accent",
  validated: "ok",
  converted: "ok",
  escalated: "warn",
};

function fmtMs(ms: number | null): string {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default async function Page() {
  const rows = await listPurchaseOrders();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">PO Intake</h1>
        <span className="hidden font-mono text-[10px] text-ink-faint sm:block">PDF → 7 layers → draft SO · &lt; 60s</span>
      </div>

      <Dropzone />

      <Card>
        <CardHeader title="Purchase orders" right={<span className="font-mono text-[10px] text-ink-faint">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={ScanText} title="No purchase orders yet" copy="Drop a PO PDF above to run grounded extraction and the seven validation layers. Grounded or it escalates." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-2">PO #</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Layers</th>
                  <th className="px-4 py-2 text-right">Elapsed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface2">
                    <td className="px-4 py-2">
                      <Link href={`/po-intake/${r.id}`} className="font-mono text-accent hover:underline">
                        {r.customerPoNumber ?? r.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{r.accountName ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{r.totalCents != null ? formatCentsExact(r.totalCents) : "—"}</td>
                    <td className="px-4 py-2"><StatusPill tone={STATUS_TONE[r.status] ?? "muted"}>{r.status}</StatusPill></td>
                    <td className="px-4 py-2 font-mono text-[11px]">
                      <span className={r.layerSummary.startsWith("failed") ? "text-danger" : r.layerSummary === "7/7" ? "text-ok" : "text-ink-faint"}>{r.layerSummary}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink-faint">{fmtMs(r.elapsedMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
