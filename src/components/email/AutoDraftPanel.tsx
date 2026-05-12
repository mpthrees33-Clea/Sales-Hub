import { useState } from 'react';
import { Sparkles, Send, RefreshCw, Edit3, X, Paperclip, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type { EmailDraft } from '../../types';
import { drafts as draftsService } from '../../services/email';

// Renders the auto-drafted reply for the currently selected email. Three
// states: no-draft-yet (shows "Generate" button), generating (shows spinner),
// draft-present (shows editable preview + send/regenerate).
//
// The new-project banner is rendered separately by the EmailPage above this
// panel — keeping the two concerns separated so the panel stays focused on
// the draft body lifecycle.

interface Props {
  draft: EmailDraft | null;
  generating: boolean;
  emailId: string | undefined;
  onGenerate: () => void;
  onRegenerate: () => void;
  onSend: (draftId: string) => void;
  onDiscard: (draftId: string) => void;
}

export default function AutoDraftPanel({
  draft,
  generating,
  emailId,
  onGenerate,
  onRegenerate,
  onSend,
  onDiscard,
}: Props) {
  const brochures = useAppStore((s) => s.brochures);
  const [editing, setEditing] = useState(false);
  const [bodyDraft, setBodyDraft] = useState('');
  const [subjectDraft, setSubjectDraft] = useState('');

  if (!emailId) return null;

  // No draft + not generating → show CTA
  if (!draft && !generating) {
    return (
      <div className="border-t border-divider bg-bg/60 p-4">
        <button
          onClick={onGenerate}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent/15 text-accent-light border border-accent/30 rounded-xl hover:bg-accent/25 hover:border-accent/50 transition-colors font-medium"
        >
          <Sparkles size={16} />
          Generate AI reply draft
        </button>
        <p className="text-xs text-fg-faint text-center mt-2">
          The AI will read this email, match it to a project, and write a reply for your review.
        </p>
      </div>
    );
  }

  if (generating || !draft) {
    return (
      <div className="border-t border-divider bg-bg/60 p-6 flex flex-col items-center justify-center gap-2">
        <Loader2 size={20} className="text-accent-light animate-spin" />
        <p className="text-sm text-fg-muted">Drafting reply…</p>
      </div>
    );
  }

  function startEdit() {
    setSubjectDraft(draft!.subject);
    setBodyDraft(draft!.body);
    setEditing(true);
  }

  function saveEdit() {
    if (!draft) return;
    draftsService.update(draft.id, {
      subject: subjectDraft,
      body: bodyDraft,
      isEdited: true,
    });
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function removeBrochure(brochureId: string) {
    if (!draft) return;
    draftsService.update(draft.id, {
      attachedBrochureIds: draft.attachedBrochureIds.filter((id) => id !== brochureId),
    });
  }

  const statusBadge = (() => {
    if (draft.status === 'pending') return { text: 'Needs project link', color: 'bg-warning/15 text-warning border-warning/30' };
    if (draft.status === 'ready') return { text: 'Ready to send', color: 'bg-success/15 text-success border-success/30' };
    if (draft.status === 'sent') return { text: 'Sent', color: 'bg-fg-muted/15 text-fg-muted border-divider' };
    return { text: 'Draft', color: 'bg-accent/15 text-accent-light border-accent/30' };
  })();

  return (
    <div className="border-t border-divider bg-bg/60">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent-light" />
          <span className="text-sm font-semibold text-fg">AI-drafted reply</span>
          <span className={clsx('text-xs px-2 py-0.5 rounded border', statusBadge.color)}>
            {statusBadge.text}
          </span>
          {draft.isEdited && (
            <span className="text-xs text-fg-faint italic">edited</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRegenerate}
            disabled={draft.status === 'sent'}
            className="p-1.5 rounded-lg text-fg-muted hover:bg-surface-1 hover:text-fg-muted disabled:opacity-30"
            title="Regenerate draft"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => onDiscard(draft.id)}
            disabled={draft.status === 'sent'}
            className="p-1.5 rounded-lg text-fg-muted hover:bg-surface-1 hover:text-danger disabled:opacity-30"
            title="Discard draft"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {editing ? (
          <>
            <input
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              placeholder="Subject"
            />
            <textarea
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent font-mono resize-y"
              rows={8}
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
            />
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-fg">{draft.subject}</p>
            <pre className="text-sm text-fg whitespace-pre-wrap font-sans leading-relaxed">{draft.body}</pre>
          </>
        )}

        {/* Attachments */}
        {draft.attachedBrochureIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-divider/60">
            {draft.attachedBrochureIds.map((bid) => {
              const b = brochures.find((br) => br.id === bid);
              if (!b) return null;
              return (
                <span
                  key={bid}
                  className="flex items-center gap-1 text-xs bg-accent/15 text-accent-light border border-accent/30 rounded px-2 py-0.5"
                >
                  <Paperclip size={10} />
                  {b.name}
                  {draft.status !== 'sent' && (
                    <button
                      onClick={() => removeBrochure(bid)}
                      className="hover:text-danger"
                      title="Remove attachment"
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Action bar */}
      {draft.status !== 'sent' && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-divider">
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 text-sm text-fg-muted border border-divider rounded-lg hover:bg-surface-1"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-3 py-1.5 text-sm bg-surface-2 text-fg border border-divider rounded-lg hover:bg-accent/15"
              >
                Save edits
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-fg-muted border border-divider rounded-lg hover:bg-surface-1 hover:text-fg"
            >
              <Edit3 size={13} />
              Edit
            </button>
          )}
          <button
            onClick={() => onSend(draft.id)}
            disabled={draft.status === 'pending' || editing}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-dim active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title={draft.status === 'pending' ? 'Link or create a project first' : 'Send reply'}
          >
            <Send size={13} />
            Send
          </button>
        </div>
      )}
    </div>
  );
}
