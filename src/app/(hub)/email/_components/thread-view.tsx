"use client";

/**
 * Thread view — right pane (docs/03 §5, WO-04 task 8). Messages render TEXT-ONLY
 * from body_text (raw email HTML never reaches the DOM). Actions: draft reply
 * with AI (reply-target threads), re-run triage, archive. The quote-target seam
 * is exposed via <QuotePanelSlot/> for WO-05.
 */
import { Archive, ArchiveRestore, Bot, Paperclip, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import type { ThreadDetail } from "@/lib/queries/email";
import { TriagePill } from "./triage-pill";
import { DraftReadyChip } from "./draft-ready-chip";
import { QuotePanelSlot } from "./quote-panel-slot";

export function ThreadView({
  detail,
  busy,
  onDraftReply,
  onRetriage,
  onArchive,
}: {
  detail: ThreadDetail;
  busy: boolean;
  onDraftReply: () => void;
  onRetriage: () => void;
  onArchive: () => void;
}) {
  const isReplyTarget = detail.routingTarget === "reply";
  const isQuoteTarget = detail.routingTarget === "quote";
  const archived = detail.status === "archived";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[14px] font-semibold">{detail.subject}</h2>
          <div className="flex items-center gap-1.5">
            <TriagePill category={detail.triage} confidence={detail.triageConfidence} />
            {detail.draftApprovalId ? <DraftReadyChip approvalId={detail.draftApprovalId} /> : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {isQuoteTarget ? <QuotePanelSlot threadId={detail.id} /> : null}
        {detail.messages.map((m) => (
          <div key={m.id} className="rounded-md border border-line">
            <div className="flex items-center justify-between border-b border-line bg-surface2/40 px-3 py-1.5">
              <span className="font-mono text-[11px] text-ink-muted">
                {m.direction === "outbound" ? "Cole" : m.from} {m.direction === "outbound" ? `→ ${m.to.join(", ")}` : ""}
              </span>
              <span className="font-mono text-[10px] text-ink-faint">{new Date(m.receivedAt).toLocaleString()}</span>
            </div>
            {/* text-only — never dangerouslySetInnerHTML */}
            <pre className="whitespace-pre-wrap break-words px-3 py-2 font-sans text-[13px] leading-relaxed">{m.bodyText}</pre>
            {m.attachments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
                {m.attachments.map((a) => (
                  <a
                    key={a.blobKey}
                    href={`/api/blob/${a.blobKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-accent hover:border-accent"
                  >
                    <Paperclip className="h-3 w-3" /> {a.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {isReplyTarget ? (
          <Button variant="primary" onClick={onDraftReply} disabled={busy}>
            <Bot className="h-3.5 w-3.5" /> Draft reply with AI
          </Button>
        ) : null}
        <Button variant="default" onClick={onRetriage} disabled={busy}>
          <RefreshCw className="h-3.5 w-3.5" /> Re-run triage
        </Button>
        <Button variant="ghost" onClick={onArchive} disabled={busy}>
          {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          {archived ? "Unarchive" : "Archive"}
        </Button>
        <span className="ml-auto font-mono text-[10px] text-ink-faint">Drafts only — humans send</span>
      </div>
    </div>
  );
}
