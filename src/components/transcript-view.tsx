"use client";

/**
 * <TranscriptView /> (WO-07 task 6/7): speaker-colored diarized segments,
 * mm:ss timestamps, each segment addressable (#seg-N) for evidence
 * deep-links — scrolls to and flash-highlights ?seg= targets.
 */
import { useEffect, useRef } from "react";
import type { TranscriptSegment } from "@/db/schema";
import { cn } from "@/lib/utils";

const SPEAKER_COLORS = ["text-accent", "text-ok", "text-warn", "text-danger"];

function speakerColor(speaker: string, order: string[]): string {
  const idx = order.indexOf(speaker);
  return SPEAKER_COLORS[(idx >= 0 ? idx : order.length) % SPEAKER_COLORS.length]!;
}

function mmss(t: number): string {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

export function TranscriptView({
  segments,
  highlightSegment,
}: {
  segments: TranscriptSegment[];
  highlightSegment?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const speakerOrder = [...new Set(segments.map((s) => s.speaker))];

  useEffect(() => {
    if (highlightSegment == null) return;
    const el = containerRef.current?.querySelector(`#seg-${highlightSegment}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.remove("flash-highlight");
      void (el as HTMLElement).offsetWidth; // restart the animation
      el.classList.add("flash-highlight");
    }
  }, [highlightSegment]);

  return (
    <div ref={containerRef} className="space-y-2">
      {segments.map((s, i) => (
        <div key={i} id={`seg-${i}`} className="flex gap-2.5 rounded-md px-2 py-1">
          <span className="w-10 shrink-0 pt-0.5 text-right font-mono text-[10px] text-ink-faint">{mmss(s.t0)}</span>
          <div className="min-w-0">
            <span className={cn("font-mono text-[10px] font-semibold", speakerColor(s.speaker, speakerOrder))}>
              {s.speaker}
            </span>
            <p className="text-[13px] leading-relaxed">{s.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
