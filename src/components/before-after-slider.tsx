"use client";

/**
 * Before/after slider (WO-11 task 5). A draggable divider wipes between the
 * original room photo and the generated scene. Pointer-draggable and keyboard
 * accessible (focus the handle, arrow keys move it).
 */
import { useCallback, useRef, useState } from "react";

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "before",
  afterLabel = "after",
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setPos((p) => Math.max(0, p - 4)); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setPos((p) => Math.min(100, p + 4)); }
    else if (e.key === "Home") { e.preventDefault(); setPos(0); }
    else if (e.key === "End") { e.preventDefault(); setPos(100); }
  };

  return (
    <div
      ref={ref}
      className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-lg border border-line bg-surface2"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* after (full) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt="generated scene" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {/* before, clipped to the left of the divider (clip-path keeps it full-size, no squish) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={beforeUrl} alt="original room" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} draggable={false} />

      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white">{beforeLabel}</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white">{afterLabel}</span>

      {/* divider + handle */}
      <div className="absolute inset-y-0" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
        <div className="h-full w-0.5 bg-white/90 shadow" />
        <button
          type="button"
          role="slider"
          aria-label="Reveal before/after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <span aria-hidden className="text-[11px]">⇔</span>
        </button>
      </div>
    </div>
  );
}
