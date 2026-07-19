import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, Mono, StatusPill } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { auditTrail } from "@/lib/queries/approvals";

export const dynamic = "force-dynamic";

/**
 * Audit trail view (WO-03 task 14): read-only by construction — no mutation
 * actions exist for audit_log anywhere in app code.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; actor?: string }>;
}) {
  const { page: pageParam, actor } = await searchParams;
  const page = Math.max(0, parseInt(pageParam ?? "0", 10) || 0);
  const rows = (await auditTrail(101, page * 100)).filter(
    (r) => !actor || r.actor.startsWith(actor),
  );
  const hasMore = rows.length > 100;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Audit trail</h1>
          <StatusPill tone="accent">
            <Lock className="h-3 w-3" /> APPEND-ONLY
          </StatusPill>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 font-mono text-[10px]">
            {["", "agent:", "user:", "system"].map((a) => (
              <Link
                key={a || "all"}
                href={a ? `/approvals/audit?actor=${a}` : "/approvals/audit"}
                className={`rounded-full border px-2 py-0.5 ${
                  (actor ?? "") === a ? "border-accent text-accent" : "border-line text-ink-faint hover:text-ink-muted"
                }`}
              >
                {a ? a.replace(":", "") : "all"}
              </Link>
            ))}
          </div>
          <Link href="/approvals" className="font-mono text-[10px] text-ink-faint hover:text-ink-muted">
            ← Queue
          </Link>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Object</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-ink-muted">
                    {formatDateTime(r.demoAt ?? r.createdAt)}
                  </td>
                  <td className="px-3 py-1.5">
                    <Mono
                      className={
                        r.actor.startsWith("agent:")
                          ? "text-accent"
                          : r.actor === "system"
                            ? "text-ink-faint"
                            : "text-ok"
                      }
                    >
                      {r.actor.length > 24 ? r.actor.slice(0, 24) + "…" : r.actor}
                    </Mono>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px]">{r.action}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-ink-faint">
                    {r.objectType ? `${r.objectType} ${r.objectId?.slice(0, 8) ?? ""}` : "—"}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-1.5 font-mono text-[10px] text-ink-muted">
                    {r.detail ? JSON.stringify(r.detail) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line px-3 py-2">
          <span className="font-mono text-[10px] text-ink-faint">page {page + 1}</span>
          <div className="flex gap-2 font-mono text-[11px]">
            {page > 0 ? (
              <Link href={`/approvals/audit?page=${page - 1}`} className="text-accent">
                ← newer
              </Link>
            ) : null}
            {hasMore ? (
              <Link href={`/approvals/audit?page=${page + 1}`} className="text-accent">
                older →
              </Link>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
