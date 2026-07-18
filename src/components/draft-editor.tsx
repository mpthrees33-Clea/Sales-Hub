"use client";

/**
 * <DraftEditor /> — email-style editor (docs/03 §3): to/cc/subject
 * locked-but-editable, body rich-text-lite (plain text — we never render or
 * send HTML, docs/02 §5), attachment list drawn from the library only. Used by
 * the email_draft / scene_send edit path. Contract created in WO-03.
 */
import { Paperclip } from "lucide-react";

export type DraftValue = {
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  attachmentAssetIds?: string[];
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 border-b border-line py-1.5">
      <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

export function DraftEditor({
  value,
  onChange,
  attachments,
}: {
  value: DraftValue;
  onChange: (next: DraftValue) => void;
  /** Resolved attachment titles for display (library assets only). */
  attachments?: { id: string; title: string }[];
}) {
  const set = (patch: Partial<DraftValue>) => onChange({ ...value, ...patch });
  const inputCls = "min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-faint";

  return (
    <div className="rounded-md border border-line bg-surface2/40 px-3 py-1">
      <Row label="To">
        <input
          className={inputCls}
          value={value.to.join(", ")}
          onChange={(e) => set({ to: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          aria-label="Recipients"
        />
      </Row>
      <Row label="Cc">
        <input
          className={inputCls}
          value={(value.cc ?? []).join(", ")}
          onChange={(e) => set({ cc: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          aria-label="Cc"
          placeholder="—"
        />
      </Row>
      <Row label="Subject">
        <input className={inputCls} value={value.subject} onChange={(e) => set({ subject: e.target.value })} aria-label="Subject" />
      </Row>
      <textarea
        className="mt-2 min-h-[220px] w-full resize-y bg-transparent text-[13px] leading-relaxed outline-none"
        value={value.bodyText}
        onChange={(e) => set({ bodyText: e.target.value })}
        aria-label="Body"
      />
      {attachments && attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
          {attachments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-ink-muted">
              <Paperclip className="h-3 w-3" /> {a.title}
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-2 border-t border-line pt-2 font-mono text-[10px] text-ink-faint">
          Attachments are limited to the asset library (policy gate enforces origin).
        </p>
      )}
    </div>
  );
}
