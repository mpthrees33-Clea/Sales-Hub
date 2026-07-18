"use client";

/**
 * Blocked-by-policy-gate banner (WO-03 task 10). A gate-blocked approval stays
 * in the queue with actions intact (edit to fix, or reject); this red banner
 * names the rule + reason and links to the audit entry.
 */
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function BlockedBanner({ rule, reason }: { rule: string; reason: string }) {
  return (
    <div className="mb-3 rounded-md border border-danger/40 bg-danger-dim px-3 py-2">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-danger">Blocked by policy gate</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            <span className="font-mono text-[10px] text-danger">{rule}</span> — {reason}
          </p>
          <Link href="/approvals/audit" className="mt-1 inline-block font-mono text-[10px] text-accent hover:underline">
            view audit entry →
          </Link>
        </div>
      </div>
    </div>
  );
}
