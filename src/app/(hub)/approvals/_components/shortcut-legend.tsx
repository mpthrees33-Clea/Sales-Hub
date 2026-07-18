"use client";

import { X } from "lucide-react";

const SHORTCUTS: [string, string][] = [
  ["j / k", "next / previous"],
  ["a", "approve"],
  ["e", "edit"],
  ["r", "reject"],
  ["enter", "open evidence"],
  ["shift + A", "batch-approve (low tier only)"],
  ["⌘/Ctrl + Enter", "save & approve (while editing)"],
  ["esc", "cancel edit / close panels"],
  ["?", "this legend"],
];

export function ShortcutLegend({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border border-line bg-surface p-5 shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 hover:bg-surface2"
        >
          <X className="h-4 w-4 text-ink-muted" />
        </button>
        <h3 className="text-sm font-semibold">Keyboard</h3>
        <dl className="mt-3 space-y-1.5">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between text-[12px]">
              <dt>
                <kbd className="rounded border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[10px]">{key}</kbd>
              </dt>
              <dd className="text-ink-muted">{desc}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-line pt-3 font-mono text-[10px] text-ink-faint">
          Review starts instantly — everything is drafted ahead.
        </p>
      </div>
    </div>
  );
}
