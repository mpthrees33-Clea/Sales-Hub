"use client";

/**
 * The approval inbox (WO-03) — keyboard-first, draft-ahead, edit-path
 * optimized. Left: queue grouped high → standard → low. Right: focused card.
 * j/k · a · e · r · enter · shift+A · ? — see the legend. Phone width gets a
 * full-screen list → card layer with a fixed bottom action bar.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileText,
  FolderCheck,
  Inbox,
  Mail,
  Package,
  Pencil,
  ShieldAlert,
  Table2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { AgentBadge } from "@/components/agent-badge";
import { EvidenceChips } from "@/components/evidence-chips";
import { RiskTierTag } from "@/components/risk-tier-tag";
import { Button, Card, EmptyState } from "@/components/ui";
import type { AssetOption } from "@/components/draft-editor";
import { relativeAge } from "@/lib/dates";
import type { QueueApproval, ResolvedEvidence } from "@/lib/queries/approvals";
import { cn } from "@/lib/utils";
import { resolveApproval, resolveApprovalsBatch, type ResolveResult } from "../actions";
import { CardBody } from "./cards";
import { EditBody } from "./edit-body";
import { EvidencePanel } from "./evidence-panel";
import { ShortcutLegend } from "./shortcut-legend";

const KIND_ICON: Record<string, typeof Mail> = {
  email_draft: Mail,
  quote: Table2,
  sales_order: FileText,
  sample_order: Package,
  opportunity_update: TrendingUp,
  submittal: FolderCheck,
  scene_send: FileText,
};

const KIND_LABEL: Record<string, string> = {
  email_draft: "Email draft",
  quote: "Quote",
  sales_order: "Sales order",
  sample_order: "Sample order",
  opportunity_update: "Opportunity update",
  submittal: "Submittal",
  scene_send: "Scene send",
};

type Toast = { id: number; tone: "ok" | "warn" | "danger"; text: string };

export function ApprovalsClient({
  initialQueue,
  demoNow,
  assetOptions,
  initialSelectedId,
}: {
  initialQueue: QueueApproval[];
  demoNow: string;
  assetOptions: AssetOption[];
  initialSelectedId?: string;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && initialQueue.some((a) => a.id === initialSelectedId)
      ? initialSelectedId
      : (initialQueue[0]?.id ?? null),
  );
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [editedPayload, setEditedPayload] = useState<Record<string, unknown> | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState<ResolvedEvidence | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [mobileCardOpen, setMobileCardOpen] = useState(Boolean(initialSelectedId));
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const selected = queue.find((a) => a.id === selectedId) ?? null;
  const assetTitles = useMemo(() => new Map(assetOptions.map((a) => [a.id, a.title])), [assetOptions]);
  const lowTierIds = useMemo(() => queue.filter((a) => a.riskTier === "low").map((a) => a.id), [queue]);
  const demoNowDate = useMemo(() => new Date(demoNow), [demoNow]);

  const pushToast = useCallback((tone: Toast["tone"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const removeFromQueue = useCallback(
    (id: string) => {
      setLeaving((s) => new Set(s).add(id));
      setTimeout(() => {
        setQueue((q) => {
          const idx = q.findIndex((a) => a.id === id);
          const next = q.filter((a) => a.id !== id);
          const nextSel = next[Math.min(idx, next.length - 1)]?.id ?? null;
          setSelectedId((cur) => (cur === id ? nextSel : cur));
          return next;
        });
        setLeaving((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }, 200);
    },
    [],
  );

  const handleResult = useCallback(
    (id: string, res: ResolveResult, verb: string) => {
      if (res.outcome === "approved") {
        pushToast("ok", `${verb} · logged #${res.auditRef}`);
        removeFromQueue(id);
      } else if (res.outcome === "rejected") {
        pushToast("ok", "Rejected — nothing executed");
        removeFromQueue(id);
      } else if (res.outcome === "expired") {
        pushToast("warn", "Expired — removed from the queue, never executed");
        removeFromQueue(id);
      } else if (res.outcome === "blocked") {
        pushToast("danger", `Blocked by policy gate: ${res.rule}`);
        setQueue((q) =>
          q.map((a) => (a.id === id ? { ...a, blockedReason: { rule: res.rule, reason: res.reason } } : a)),
        );
      } else {
        pushToast("danger", res.message);
      }
    },
    [pushToast, removeFromQueue],
  );

  const approve = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await resolveApproval({ id, resolution: "approve" });
        handleResult(id, res, "Sent");
      } finally {
        setBusy(false);
      }
    },
    [busy, handleResult],
  );

  const reject = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await resolveApproval({ id, resolution: "reject" });
        handleResult(id, res, "Rejected");
      } finally {
        setBusy(false);
      }
    },
    [busy, handleResult],
  );

  const saveAndApprove = useCallback(async () => {
    if (!selected || !editedPayload || busy) return;
    setBusy(true);
    try {
      const res = await resolveApproval({ id: selected.id, resolution: "edit_approve", edited: editedPayload });
      handleResult(selected.id, res, "Saved & sent");
      if (res.outcome === "approved") {
        setEditing(false);
        setEditedPayload(null);
      }
    } finally {
      setBusy(false);
    }
  }, [selected, editedPayload, busy, handleResult]);

  const startEdit = useCallback(() => {
    if (!selected) return;
    setEditedPayload(structuredClone(selected.proposedAction));
    setEditing(true);
  }, [selected]);

  const move = useCallback(
    (dir: 1 | -1) => {
      setSelectedId((cur) => {
        const idx = queue.findIndex((a) => a.id === cur);
        const next = queue[Math.min(queue.length - 1, Math.max(0, idx + dir))];
        return next?.id ?? cur;
      });
    },
    [queue],
  );

  const runBatch = useCallback(async () => {
    setBatchOpen(false);
    setBusy(true);
    try {
      const res = await resolveApprovalsBatch(lowTierIds);
      pushToast(
        res.blocked + res.errors > 0 ? "warn" : "ok",
        `Batch: ${res.approved} approved${res.blocked ? `, ${res.blocked} blocked` : ""}${res.errors ? `, ${res.errors} errors` : ""}`,
      );
      for (const id of lowTierIds) removeFromQueue(id);
    } finally {
      setBusy(false);
    }
  }, [lowTierIds, pushToast, removeFromQueue]);

  // Keyboard map (WO-03 task 4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (editing) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void saveAndApprove();
        } else if (e.key === "Escape") {
          setEditing(false);
          setEditedPayload(null);
        }
        return;
      }
      if (typing) return;
      if (e.key === "Escape") {
        setEvidenceOpen(null);
        setLegendOpen(false);
        setBatchOpen(false);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setLegendOpen((v) => !v);
      } else if (e.key === "j") move(1);
      else if (e.key === "k") move(-1);
      else if (e.key === "a" && !e.shiftKey && selected) void approve(selected.id);
      else if (e.key === "A" && e.shiftKey) {
        if (lowTierIds.length > 0) setBatchOpen(true);
      } else if (e.key === "r" && selected) void reject(selected.id);
      else if (e.key === "e" && selected) startEdit();
      else if (e.key === "Enter" && selected && selected.evidence.length > 0) {
        e.preventDefault();
        setEvidenceOpen(selected.evidence[0]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, selected, move, approve, reject, startEdit, saveAndApprove, lowTierIds]);

  const groups = useMemo(() => {
    const tiers: ("high" | "standard" | "low")[] = ["high", "standard", "low"];
    return tiers
      .map((tier) => ({ tier, items: queue.filter((a) => a.riskTier === tier) }))
      .filter((g) => g.items.length > 0);
  }, [queue]);

  if (queue.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Inbox}
          title="The queue is clear"
          copy="Every agent draft terminates here for human review. When the overnight run finishes, review starts instantly — everything is drafted ahead. Drafts only — humans send."
          action={
            <Link href="/dashboard" className="text-[12px] text-accent hover:opacity-80">
              Back to Mission Control →
            </Link>
          }
        />
      </Card>
    );
  }

  const list = (
    <div className="flex h-full flex-col overflow-y-auto">
      {groups.map((g) => (
        <div key={g.tier}>
          <div className="sticky top-0 z-10 border-b border-line bg-surface px-3 py-1.5">
            <RiskTierTag tier={g.tier} />
            <span className="ml-2 font-mono text-[10px] text-ink-faint">{g.items.length}</span>
            {g.tier === "low" ? (
              <span className="ml-2 font-mono text-[9px] text-ink-faint">shift+A batch</span>
            ) : null}
          </div>
          {g.items.map((a) => {
            const Icon = KIND_ICON[a.kind] ?? Mail;
            const active = a.id === selectedId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelectedId(a.id);
                  setEditing(false);
                  setEditedPayload(null);
                  setMobileCardOpen(true);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors",
                  active ? "bg-surface2" : "hover:bg-surface2/60",
                  leaving.has(a.id) && "card-out",
                )}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{summaryLine(a)}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
                    {a.agentName}
                    <span>· {relativeAge(new Date(a.createdDemoAt), demoNowDate)}</span>
                    {a.blockedReason ? <ShieldAlert className="h-3 w-3 text-danger" /> : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const card = selected ? (
    <div className={cn("flex h-full flex-col", leaving.has(selected.id) && "card-out")}>
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <button
          type="button"
          onClick={() => setMobileCardOpen(false)}
          className="mr-1 rounded-md p-1 hover:bg-surface2 sm:hidden"
          aria-label="Back to queue"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-medium">{KIND_LABEL[selected.kind]}</span>
        <RiskTierTag tier={selected.riskTier} />
        <AgentBadge agentName={selected.agentName} tools={selected.agentTools} />
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-ink-faint">
          {relativeAge(new Date(selected.createdDemoAt), demoNowDate)}
          {selected.runId ? (
            <Link href={`/dashboard?run=${selected.runId}`} className="text-accent hover:opacity-80">
              run trace →
            </Link>
          ) : null}
        </span>
      </header>

      {selected.blockedReason ? (
        <div className="flex items-start gap-2 border-b border-danger/40 bg-danger-dim px-4 py-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="text-xs font-medium text-danger">
              Blocked by policy gate · <span className="font-mono">{selected.blockedReason.rule}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {selected.blockedReason.reason} —{" "}
              <Link href="/approvals/audit" className="text-accent hover:opacity-80">
                view audit entry
              </Link>
              . Edit to fix, or reject.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4 pb-24 sm:pb-4">
        {editing && editedPayload ? (
          <EditBody
            kind={selected.kind}
            payload={editedPayload}
            onChange={setEditedPayload}
            assetOptions={assetOptions}
          />
        ) : (
          <CardBody approval={selected} assetTitles={assetTitles} />
        )}
        {selected.evidence.length > 0 && !editing ? (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Evidence — every answer shows its source
            </p>
            <EvidenceChips evidence={selected.evidence} onOpen={(e) => setEvidenceOpen(e as ResolvedEvidence)} />
          </div>
        ) : null}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-line bg-surface px-4 py-3 sm:static">
        {editing ? (
          <>
            <Button variant="primary" onClick={() => void saveAndApprove()} disabled={busy} className="min-h-[44px] flex-1 sm:flex-none">
              <Check className="h-3.5 w-3.5" /> Save & approve
              <span className="ml-1 hidden font-mono text-[9px] opacity-70 sm:inline">⌘↩</span>
            </Button>
            <Button
              onClick={() => {
                setEditing(false);
                setEditedPayload(null);
              }}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={() => void approve(selected.id)} disabled={busy} className="min-h-[44px] flex-1 sm:flex-none">
              <Check className="h-3.5 w-3.5" /> Approve
              <span className="ml-1 hidden font-mono text-[9px] opacity-70 sm:inline">a</span>
            </Button>
            <Button onClick={startEdit} className="min-h-[44px] flex-1 sm:flex-none">
              <Pencil className="h-3.5 w-3.5" /> Edit
              <span className="ml-1 hidden font-mono text-[9px] opacity-70 sm:inline">e</span>
            </Button>
            <Button variant="danger" onClick={() => void reject(selected.id)} disabled={busy} className="min-h-[44px] flex-1 sm:flex-none">
              <XCircle className="h-3.5 w-3.5" /> Reject
              <span className="ml-1 hidden font-mono text-[9px] opacity-70 sm:inline">r</span>
            </Button>
          </>
        )}
      </footer>
    </div>
  ) : null;

  return (
    <>
      <div className="flex h-[calc(100vh-8.5rem)] overflow-hidden rounded-lg border border-line bg-surface">
        {/* Phone: list OR card. Desktop: both. */}
        <div className={cn("w-full sm:w-80 sm:shrink-0 sm:border-r sm:border-line", mobileCardOpen && "hidden sm:block")}>
          {list}
        </div>
        <div className={cn("min-w-0 flex-1", !mobileCardOpen && "hidden sm:block")}>{card}</div>
      </div>

      {evidenceOpen ? <EvidencePanel item={evidenceOpen} onClose={() => setEvidenceOpen(null)} /> : null}
      {legendOpen ? <ShortcutLegend onClose={() => setLegendOpen(false)} /> : null}
      {batchOpen ? (
        <BatchConfirm
          items={queue.filter((a) => a.riskTier === "low")}
          onCancel={() => setBatchOpen(false)}
          onConfirm={() => void runBatch()}
        />
      ) : null}

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-1.5 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-full border px-3.5 py-1.5 font-mono text-[11px] shadow-lg",
              t.tone === "ok" && "border-ok/40 bg-surface text-ok",
              t.tone === "warn" && "border-warn/40 bg-surface text-warn",
              t.tone === "danger" && "border-danger/40 bg-surface text-danger",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}

function BatchConfirm({
  items,
  onCancel,
  onConfirm,
}: {
  items: QueueApproval[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const kinds = [...new Set(items.map((a) => KIND_LABEL[a.kind]))].join(", ");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-lg border border-line bg-surface p-5 shadow-2xl">
        <h3 className="text-sm font-semibold">
          Approve {items.length} low-tier item{items.length === 1 ? "" : "s"}?
        </h3>
        <p className="mt-2 text-[12px] text-ink-muted">
          {kinds}. The policy gate re-runs per item at execution time; higher tiers are structurally excluded from
          batch.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>
            <Check className="h-3.5 w-3.5" /> Approve all
          </Button>
        </div>
      </div>
    </div>
  );
}

function summaryLine(a: QueueApproval): string {
  const p = a.proposedAction as Record<string, unknown>;
  if (p.escalation) return `Escalated: ${(p.escalation as { reason?: string }).reason ?? "needs input"}`;
  switch (a.kind) {
    case "email_draft":
      return String(p.subject ?? "Email draft");
    case "quote":
      return `${p.quoteNumber ?? "Quote"} — ${p.accountName ?? ""}`;
    case "sales_order":
      return `SO for ${p.accountName ?? "account"} · PO ${p.customerPoNumber ?? ""}`;
    case "sample_order":
      return `Samples → ${p.contactName ?? p.accountName ?? "contact"}`;
    case "opportunity_update": {
      const created = (p.newOpportunity as { name?: string } | undefined)?.name;
      return created ? `NEW: ${created}` : `Update — ${p.accountName ?? "opportunity"}`;
    }
    case "submittal":
      return String(p.packageTitle ?? p.projectName ?? "Submittal package");
    default:
      return KIND_LABEL[a.kind] ?? a.kind;
  }
}

