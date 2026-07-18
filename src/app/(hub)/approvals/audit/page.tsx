/**
 * Audit trail view (WO-03 task 14). Read-only, filterable, paginated view of
 * audit_log — the append-only spine (docs/02 §2.5). No mutation affordance
 * exists here by construction: audit_log has exactly one write path (audit())
 * and zero update/delete paths anywhere in app code.
 */
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Lock } from "lucide-react";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

const PER = 50;
const FILTERS = ["approval.approved", "approval.rejected", "policy.blocked", "effect.executed", "approval.expired"];

function actorTone(actor: string): string {
  if (actor.startsWith("agent:")) return "text-accent";
  if (actor.startsWith("user:")) return "text-ok";
  return "text-ink-muted";
}

function detailSummary(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  const keys = ["rule", "reason", "provider", "ref", "kind", "status"];
  const parts = keys.filter((k) => detail[k] != null).map((k) => `${k}=${String(detail[k])}`);
  return parts.join(" · ") || JSON.stringify(detail).slice(0, 80);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; p?: string }> }) {
  const { action, p } = await searchParams;
  const page = Math.max(1, parseInt(p ?? "1", 10) || 1);
  const rows = await db
    .select()
    .from(auditLog)
    .where(action ? eq(auditLog.action, action) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(PER + 1)
    .offset((page - 1) * PER);
  const hasNext = rows.length > PER;
  const pageRows = rows.slice(0, PER);

  const q = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const a = patch.action ?? action;
    const pg = patch.p;
    if (a) sp.set("action", a);
    if (pg) sp.set("p", pg);
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/approvals" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> queue
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Audit trail</h1>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-ink-muted">
          <Lock className="h-3 w-3" /> Append-only
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link href="/approvals/audit" className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", !action ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}>
          all
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/approvals/audit${q({ action: f, p: undefined })}`}
            className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", action === f ? "border-accent text-accent" : "border-line text-ink-muted hover:text-ink")}
          >
            {f}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Log" right={<span className="font-mono text-[10px] text-ink-faint">page {page}</span>} />
        {pageRows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-ink-muted">No audit entries for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-line font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Object</th>
                  <th className="px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-ink-muted">{formatDateTime(r.demoAt ?? r.createdAt)}</td>
                    <td className={cn("whitespace-nowrap px-3 py-2 font-mono", actorTone(r.actor))}>{r.actor}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-ink">{r.action}</td>
                    <td className="px-3 py-2 font-mono text-ink-faint">
                      {r.objectType ? `${r.objectType}:` : ""}
                      {r.objectId ? r.objectId.slice(0, 8) : "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{detailSummary(r.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          {page > 1 ? (
            <Link href={`/approvals/audit${q({ p: String(page - 1) })}`} className="font-mono text-[10px] text-accent hover:underline">
              ← newer
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link href={`/approvals/audit${q({ p: String(page + 1) })}`} className="font-mono text-[10px] text-accent hover:underline">
              older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </Card>
    </div>
  );
}
