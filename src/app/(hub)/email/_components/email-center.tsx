"use client";

/**
 * Email center orchestrator (WO-04 task 8) — three panes: filters, thread list,
 * thread view. Invokes the triage / reply / compose / archive server actions
 * (all approval-gated — no send path) and refreshes via revalidation.
 */
import { useMemo, useState, useTransition } from "react";
import { Archive, Inbox, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { ThreadRow, ThreadDetail } from "@/lib/queries/email";
import { ThreadList } from "./thread-list";
import { ThreadView } from "./thread-view";
import { ComposeDialog, type ContactOption } from "./compose-dialog";
import { archiveThreadAction, composeAction, draftQuoteAction, draftReplyAction, rerunTriageAction } from "../actions";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs review" },
  { key: "quote_request", label: "Quotes" },
  { key: "stock_check", label: "Stock checks" },
  { key: "po", label: "POs" },
  { key: "sample_request", label: "Samples" },
  { key: "submittal_request", label: "Submittals" },
  { key: "scheduling", label: "Scheduling" },
  { key: "general", label: "General" },
  { key: "drafts", label: "Drafts pending" },
  { key: "archived", label: "Archived / Noise" },
];

export function EmailCenter({
  threads,
  details,
  contacts,
  demoNow,
}: {
  threads: ThreadRow[];
  details: Record<string, ThreadDetail>;
  contacts: ContactOption[];
  demoNow: string;
}) {
  const now = useMemo(() => new Date(demoNow), [demoNow]);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return threads.filter((t) => {
      switch (filter) {
        case "all":
          return t.status !== "archived";
        case "needs_review":
          return t.status === "needs_review";
        case "archived":
          return t.status === "archived" || t.triage === "noise";
        case "drafts":
          return !!t.draftApprovalId;
        default:
          return t.triage === filter && t.status !== "archived";
      }
    });
  }, [threads, filter]);

  const selected = selectedId ? details[selectedId] ?? null : null;

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((c) => (c === text ? null : c)), 2600);
  };

  const run = (fn: () => Promise<void>) => startTransition(async () => { await fn(); });

  const onDraftReply = () => {
    const routingId = selected?.routingId;
    if (!routingId) return;
    run(async () => {
      const r = await draftReplyAction(routingId);
      flash(r.approvalId ? "Draft ready — review in Approvals" : `Reply ${r.status}`);
    });
  };

  const onDraftQuote = () => {
    const routingId = selected?.routingId;
    if (!routingId) return;
    run(async () => {
      const r = await draftQuoteAction(routingId);
      flash(r.approvalId ? "Quote drafted — review in Approvals" : `Quote ${r.status}`);
    });
  };

  const onRetriage = () => {
    const emailId = threads.find((t) => t.id === selectedId)?.inboundEmailId;
    if (!emailId) return;
    run(async () => {
      const r = await rerunTriageAction(emailId);
      flash(`Re-triaged: ${r.category}`);
    });
  };

  const onArchive = () => {
    if (!selected) return;
    const archived = selected.status === "archived";
    run(async () => {
      await archiveThreadAction(selected.id, !archived);
      flash(archived ? "Unarchived" : "Archived");
    });
  };

  const onCompose = (input: { to: string[]; subject: string; intent: string; accountId?: string }) => {
    run(async () => {
      const r = await composeAction(input);
      setComposeOpen(false);
      flash(r.approvalId ? "Draft ready — review in Approvals" : `Compose ${r.status}`);
    });
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Email</h1>
          <span className="font-mono text-[11px] text-ink-faint">{threads.filter((t) => t.status !== "archived").length} threads</span>
        </div>
        <Button variant="default" onClick={() => setComposeOpen(true)} disabled={pending}>
          <PenLine className="h-3.5 w-3.5" /> Compose with AI
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-line">
        {/* Filters */}
        <div className="hidden w-40 shrink-0 flex-col overflow-y-auto border-r border-line p-2 md:flex">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-[12px] transition-colors",
                filter === f.key ? "bg-accent-dim text-accent" : "text-ink-muted hover:bg-surface2 hover:text-ink",
              )}
            >
              {f.key === "archived" ? <Archive className="h-3 w-3" /> : f.key === "all" ? <Inbox className="h-3 w-3" /> : <span className="w-3" />}
              {f.label}
            </button>
          ))}
        </div>

        {/* Thread list */}
        <div className={cn("min-h-0 w-full overflow-y-auto border-r border-line md:w-72", selected ? "hidden md:block" : "block")}>
          <ThreadList threads={filtered} selectedId={selectedId} onSelect={setSelectedId} now={now} />
        </div>

        {/* Thread view */}
        <div className={cn("min-h-0 min-w-0 flex-1 bg-surface", selected ? "block" : "hidden md:block")}>
          {selected ? (
            <div className="flex h-full min-h-0 flex-col">
              <button type="button" onClick={() => setSelectedId(null)} className="border-b border-line px-4 py-2 text-left font-mono text-[11px] text-ink-muted md:hidden">
                ← threads
              </button>
              <div className="min-h-0 flex-1">
                <ThreadView detail={selected} busy={pending} onDraftReply={onDraftReply} onDraftQuote={onDraftQuote} onRetriage={onRetriage} onArchive={onArchive} />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <p className="text-[12px] text-ink-muted">Select a thread. Triage pills show the agent&rsquo;s classification and confidence.</p>
            </div>
          )}
        </div>
      </div>

      {composeOpen ? <ComposeDialog contacts={contacts} busy={pending} onSubmit={onCompose} onClose={() => setComposeOpen(false)} /> : null}
      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 font-mono text-[11px] shadow-xl">{toast}</div>
      ) : null}
    </div>
  );
}
