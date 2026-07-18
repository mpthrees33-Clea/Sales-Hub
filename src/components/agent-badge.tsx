"use client";

/**
 * Agent name + scoped-tool count; popover lists tools with effect tags
 * (docs/03 §3 — "Permissioned Tools made visible"). Contract fixed in WO-01.
 */
import { useState } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentBadgeTool = { name: string; effect: "read" | "internal_write" | "external" };

const EFFECT_LABEL: Record<AgentBadgeTool["effect"], { label: string; cls: string }> = {
  read: { label: "read", cls: "text-ok" },
  internal_write: { label: "internal", cls: "text-accent" },
  external: { label: "external · gated", cls: "text-warn" },
};

export function AgentBadge({ agentName, tools }: { agentName: string; tools: AgentBadgeTool[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[10px] text-ink-muted transition-colors hover:text-ink"
        title="Scoped tools — Permissioned Tools"
      >
        <Bot className="h-3 w-3" strokeWidth={1.75} />
        {agentName}
        <span className="text-ink-faint">· {tools.length} tools</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-md border border-line bg-surface p-3 shadow-xl">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Permissioned tools · explicit allowlist
          </p>
          {tools.length === 0 ? (
            <p className="text-[11px] text-ink-muted">
              Empty allowlist — this agent sees one document and returns JSON. Zero reach.
            </p>
          ) : (
            <ul className="space-y-1">
              {tools.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="truncate text-ink">{t.name}</span>
                  <span className={cn("shrink-0 text-[10px]", EFFECT_LABEL[t.effect].cls)}>
                    {EFFECT_LABEL[t.effect].label}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 border-t border-line pt-2 text-[10px] leading-relaxed text-ink-faint">
            External-effect tools never execute from a model loop — calls become approvals in this queue.
          </p>
        </div>
      ) : null}
    </span>
  );
}
