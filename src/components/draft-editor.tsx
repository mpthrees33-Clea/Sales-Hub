"use client";

/**
 * <DraftEditor /> (docs/03 §3): email-style editor — to/cc/subject
 * locked-but-editable, plain-text body, attachments picked from the asset
 * library ONLY (the policy gate's attachment-origin check passes by
 * construction). Used inline by the approval card's edit path.
 */
import { useState } from "react";
import { Paperclip, X } from "lucide-react";

export type DraftValue = {
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string;
  attachmentAssetIds: string[];
};

export type AssetOption = { id: string; title: string; kind: string };

export function DraftEditor({
  value,
  onChange,
  assetOptions,
}: {
  value: DraftValue;
  onChange: (v: DraftValue) => void;
  assetOptions: AssetOption[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const set = (patch: Partial<DraftValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2">
      <Field label="To">
        <input
          className={inputCls}
          value={value.to.join(", ")}
          onChange={(e) => set({ to: splitAddresses(e.target.value) })}
        />
      </Field>
      <Field label="Cc">
        <input
          className={inputCls}
          value={value.cc.join(", ")}
          onChange={(e) => set({ cc: splitAddresses(e.target.value) })}
        />
      </Field>
      <Field label="Subject">
        <input className={inputCls} value={value.subject} onChange={(e) => set({ subject: e.target.value })} />
      </Field>
      <textarea
        className={`${inputCls} min-h-[220px] font-mono text-[12px] leading-relaxed`}
        value={value.bodyText}
        onChange={(e) => set({ bodyText: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {value.attachmentAssetIds.map((id) => {
          const asset = assetOptions.find((a) => a.id === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-2 py-1 font-mono text-[10px] text-ink-muted"
            >
              <Paperclip className="h-3 w-3" />
              {asset?.title ?? id}
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => set({ attachmentAssetIds: value.attachmentAssetIds.filter((x) => x !== id) })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-1 font-mono text-[10px] text-ink-faint hover:border-line-strong hover:text-ink-muted"
          >
            <Paperclip className="h-3 w-3" /> attach from library
          </button>
          {pickerOpen ? (
            <div className="absolute bottom-full left-0 z-30 mb-1.5 max-h-56 w-72 overflow-y-auto rounded-md border border-line bg-surface p-1.5 shadow-xl">
              <p className="px-1.5 pb-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                Library assets — the only legal attachment source
              </p>
              {assetOptions
                .filter((a) => !value.attachmentAssetIds.includes(a.id))
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      set({ attachmentAssetIds: [...value.attachmentAssetIds, a.id] });
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-surface2"
                  >
                    <span className="truncate">{a.title}</span>
                    <span className="shrink-0 font-mono text-[9px] text-ink-faint">{a.kind}</span>
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function splitAddresses(s: string): string[] {
  return s
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
