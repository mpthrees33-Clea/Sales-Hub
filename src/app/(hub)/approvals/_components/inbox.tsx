"use client";

/**
 * Approvals inbox orchestrator (WO-03). Keyboard-first, draft-ahead: the queue
 * is pre-fetched so selection is instant. Holds selection + edit state, wires
 * the keyboard map, opens evidence source panels, runs batch approve, and calls
 * the resolution server action (the only executor). Approve/reject slide the
 * card out, decrement the count, and toast the audit id.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { ApprovalCard } from "@/components/approval-card";
import { EvidenceChips } from "@/components/evidence-chips";
import { cn } from "@/lib/utils";
import type { LoadedApproval } from "@/lib/queries/approvals";
import { resolveApproval, resolveApprovalsBatch } from "../actions";
import { QueueList } from "./queue-list";
import { EvidencePanel } from "./evidence-panel";
import { BlockedBanner } from "./blocked-banner";
import { BatchConfirm } from "./batch-confirm";
import { WhyPopover } from "./why-popover";
import { ShortcutLegend } from "./shortcut-legend";
import { useApprovalKeys } from "./use-approval-keys";
import { CardEmailDraft, CardGeneric, CardOpportunityUpdate, CardQuote, CardSalesOrder, CardSampleOrder, CardSubmittal } from "./cards";

type BlockInfo = { rule: string; reason: string };

export function ApprovalsInbox({ demoNow, pending, initialId }: { demoNow: string; pending: LoadedApproval[]; initialId: string | null }) {
  const [list, setList] = useState<LoadedApproval[]>(pending);
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? pending[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<Record<string, unknown> | null>(null);
  const [evidenceIndex, setEvidenceIndex] = useState<number | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [slidingOut, setSlidingOut] = useState<string | null>(null);
  const [localBlocks, setLocalBlocks] = useState<Record<string, BlockInfo>>({});

  const selected = useMemo(() => list.find((a) => a.id === selectedId) ?? null, [list, selectedId]);
  const lowItems = useMemo(() => list.filter((a) => a.riskTier === "low"), [list]);

  // Deep-linkable selection without a server round-trip.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("id", selectedId);
    else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
  }, [selectedId]);

  const flashToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 2600);
  }, []);

  const removeAfterSlide = useCallback(
    (id: string) => {
      setSlidingOut(id);
      setTimeout(() => {
        setList((prev) => {
          const idx = prev.findIndex((a) => a.id === id);
          const next = prev.filter((a) => a.id !== id);
          setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null);
          return next;
        });
        setSlidingOut(null);
        setEditing(false);
        setEdited(null);
      }, 180);
    },
    [],
  );

  const beginEdit = useCallback(() => {
    if (!selected) return;
    setEdited(structuredClone(selected.proposedAction));
    setEditing(true);
  }, [selected]);

  const patch = useCallback((mutator: (draft: Record<string, unknown>) => void) => {
    setEdited((prev) => {
      const next = structuredClone(prev ?? {});
      mutator(next);
      return next;
    });
  }, []);

  const doResolve = useCallback(
    async (id: string, resolution: "approve" | "edit_approve" | "reject", editedPayload?: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await resolveApproval({ id, resolution, edited: editedPayload });
        if (res.outcome === "approved") {
          flashToast(`Sent · logged #${res.auditId.slice(0, 6)}`);
          removeAfterSlide(id);
        } else if (res.outcome === "rejected") {
          flashToast("Rejected · logged");
          removeAfterSlide(id);
        } else if (res.outcome === "expired") {
          flashToast("Expired — not sent");
          removeAfterSlide(id);
        } else if (res.outcome === "blocked") {
          setLocalBlocks((b) => ({ ...b, [id]: { rule: res.rule, reason: res.reason } }));
          flashToast(`Blocked by policy gate: ${res.rule}`);
        } else {
          flashToast(res.outcome === "error" ? `Execution failed: ${res.message}` : res.outcome);
        }
      } finally {
        setBusy(false);
      }
    },
    [flashToast, removeAfterSlide],
  );

  const onSave = useCallback(() => {
    if (selected && edited) void doResolve(selected.id, "edit_approve", edited);
  }, [selected, edited, doResolve]);

  const confirmBatch = useCallback(async () => {
    setBusy(true);
    try {
      const ids = lowItems.map((a) => a.id);
      const res = await resolveApprovalsBatch(ids);
      const blockedIds = new Set(res.blocked.map((b) => b.id));
      for (const b of res.blocked) setLocalBlocks((m) => ({ ...m, [b.id]: { rule: b.rule, reason: b.reason } }));
      setList((prev) => prev.filter((a) => !(a.riskTier === "low" && !blockedIds.has(a.id))));
      flashToast(`Approved ${res.approved}${res.blocked.length ? ` · blocked ${res.blocked.length}` : ""}`);
    } finally {
      setBusy(false);
      setBatchOpen(false);
    }
  }, [lowItems, flashToast]);

  useApprovalKeys({
    enabled: !legendOpen && !batchOpen && evidenceIndex === null,
    editing,
    onNext: () => {
      const idx = list.findIndex((a) => a.id === selectedId);
      setSelectedId(list[Math.min(idx + 1, list.length - 1)]?.id ?? selectedId);
    },
    onPrev: () => {
      const idx = list.findIndex((a) => a.id === selectedId);
      setSelectedId(list[Math.max(idx - 1, 0)]?.id ?? selectedId);
    },
    onApprove: () => selected && void doResolve(selected.id, "approve"),
    onEdit: beginEdit,
    onReject: () => selected && void doResolve(selected.id, "reject"),
    onEnter: () => selected && selected.evidence.length > 0 && setEvidenceIndex(0),
    onBatch: () => {
      if (selected?.riskTier === "low" && lowItems.length > 0) setBatchOpen(true);
    },
    onLegend: () => setLegendOpen(true),
    onSave,
    onCancel: () => {
      setEditing(false);
      setEdited(null);
    },
  });

  const proposed = editing && edited ? edited : selected?.proposedAction ?? {};
  const block = selected ? localBlocks[selected.id] ?? selected.blockedReason ?? null : null;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Approvals</h1>
          <span className="font-mono text-[11px] text-ink-faint">{list.length} pending</span>
        </div>
        <div className="flex items-center gap-3">
          <WhyPopover />
          <button type="button" onClick={() => setLegendOpen(true)} className="font-mono text-[10px] text-ink-muted hover:text-ink">
            ? shortcuts
          </button>
          <Link href="/approvals/audit" className="flex items-center gap-1 font-mono text-[10px] text-accent hover:underline">
            <ScrollText className="h-3 w-3" /> audit
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-line">
        {/* Queue list */}
        <div className={cn("min-h-0 w-full overflow-y-auto border-r border-line sm:w-80", selected ? "hidden sm:block" : "block")}>
          <QueueList pending={list} demoNow={demoNow} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        {/* Focused card */}
        <div className={cn("min-h-0 min-w-0 flex-1 bg-surface", selected ? "flex" : "hidden sm:flex")}>
          {selected ? (
            <div className={cn("flex min-h-0 w-full flex-col", slidingOut === selected.id && "card-out")}>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1 border-b border-line px-4 py-2 text-left font-mono text-[11px] text-ink-muted sm:hidden"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> queue
              </button>
              <ApprovalCard
                agentName={selected.agentName}
                agentTools={selected.agentTools}
                riskTier={selected.riskTier}
                ageLabel={relLabel(selected.createdDemoAt, demoNow)}
                expiryLabel={new Date(selected.expiresDemoAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                runId={selected.runId}
                editing={editing}
                busy={busy}
                headerRight={selected.kind === "email_draft" ? <WhyPopover compact /> : undefined}
                onApprove={() => void doResolve(selected.id, "approve")}
                onEdit={beginEdit}
                onReject={() => void doResolve(selected.id, "reject")}
                onSave={onSave}
                onCancel={() => {
                  setEditing(false);
                  setEdited(null);
                }}
              >
                {block ? <BlockedBanner rule={block.rule} reason={block.reason} /> : null}
                {selected.evidence.length > 0 ? (
                  <div className="mb-3">
                    <EvidenceChips evidence={selected.evidence.map((e) => ({ type: e.type, ref: {}, quote: e.quote }))} onOpen={(_, i) => setEvidenceIndex(i)} />
                  </div>
                ) : null}
                <CardBody kind={selected.kind} proposed={proposed} editing={editing} patch={patch} />
              </ApprovalCard>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <p className="text-[12px] text-ink-muted">Select an approval to review. Drafts only — humans send.</p>
            </div>
          )}
        </div>
      </div>

      {evidenceIndex !== null && selected?.evidence[evidenceIndex] ? (
        <EvidencePanel evidence={selected.evidence[evidenceIndex]} onClose={() => setEvidenceIndex(null)} />
      ) : null}
      {batchOpen ? (
        <BatchConfirm count={lowItems.length} kinds={[...new Set(lowItems.map((a) => a.kind))]} busy={busy} onConfirm={() => void confirmBatch()} onCancel={() => setBatchOpen(false)} />
      ) : null}
      <ShortcutLegend open={legendOpen} onClose={() => setLegendOpen(false)} />

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 font-mono text-[11px] shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function CardBody({ kind, proposed, editing, patch }: { kind: string; proposed: Record<string, unknown>; editing: boolean; patch: (m: (d: Record<string, unknown>) => void) => void }) {
  const props = { proposed, editing, patch };
  switch (kind) {
    case "email_draft":
      return <CardEmailDraft {...props} />;
    case "quote":
      return <CardQuote {...props} />;
    case "sales_order":
      return <CardSalesOrder {...props} />;
    case "sample_order":
      return <CardSampleOrder {...props} />;
    case "opportunity_update":
      return <CardOpportunityUpdate {...props} />;
    case "submittal":
      return <CardSubmittal {...props} />;
    default:
      return <CardGeneric {...props} />;
  }
}

function relLabel(createdIso: string, demoNowIso: string): string {
  const mins = Math.max(0, Math.round((new Date(demoNowIso).getTime() - new Date(createdIso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
