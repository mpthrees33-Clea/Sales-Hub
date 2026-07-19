"use client";

/**
 * <TranscriptView /> (WO-07) — speaker-colored diarized segments, each
 * addressable by index (#seg-N) for evidence deep-links. A `?seg=N` param (from
 * a transcript_segment evidence chip) scrolls to and flash-highlights the
 * segment. Colors are deterministic per speaker and dark-mode legible.
 */
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type Segment = { speaker: string; t0: number; t1: number; text: string };

const SPEAKER_CLASSES = ["text-accent", "text-ok", "text-warn", "text-danger"] as const;

function speakerColor(speaker: string, order: string[]): string {
  const i = order.indexOf(speaker);
  return SPEAKER_CLASSES[i % SPEAKER_CLASSES.length]!;
}

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function TranscriptView({ segments }: { segments: Segment[] }) {
  const params = useSearchParams();
  const seg = params.get("seg");
  const containerRef = useRef<HTMLOListElement>(null);
  const order = [...new Set(segments.map((s) => s.speaker))];

  useEffect(() => {
    if (seg == null) return;
    const el = document.getElementById(`seg-${seg}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash-highlight");
      // reflow to restart the animation
      void el.offsetWidth;
      el.classList.add("flash-highlight");
    }
  }, [seg]);

  if (segments.length === 0) {
    return <p className="px-1 py-6 text-center font-mono text-[11px] text-ink-faint">No transcript yet.</p>;
  }
  return (
    <ol ref={containerRef} className="space-y-2">
      {segments.map((s, i) => (
        <li key={i} id={`seg-${i}`} className="rounded-md px-2 py-1.5">
          <div className="flex items-baseline gap-2">
            <span className={cn("font-mono text-[11px] font-medium", speakerColor(s.speaker, order))}>{s.speaker}</span>
            <span className="font-mono text-[9px] text-ink-faint">{mmss(s.t0)}</span>
            <span className="font-mono text-[9px] text-ink-faint">#{i}</span>
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
