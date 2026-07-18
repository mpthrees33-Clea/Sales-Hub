"use client";

/** Shortcut legend dialog (docs/03 §4, `?`). Lists the full keyboard map. */
import { X } from "lucide-react";

const KEYS: [string, string][] = [
  ["j / k", "next / previous approval"],
  ["a", "approve"],
  ["e", "edit in place"],
  ["r", "reject"],
  ["enter", "open evidence panel"],
  ["shift + A", "batch-approve (low tier only)"],
  ["⌘/Ctrl + Enter", "save & approve (edit mode)"],
  ["esc", "cancel edit"],
  ["?", "this legend"],
];

export function ShortcutLegend({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm rounded-lg border border-line bg-surface p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-surface2 hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="space-y-1.5">
          {KEYS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-4">
              <dt className="font-mono text-[11px] text-ink">{k}</dt>
              <dd className="text-[11px] text-ink-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
