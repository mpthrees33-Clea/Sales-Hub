"use client";

/**
 * Before/after slider (WO-11 task 5): pointer-draggable divider, keyboard
 * accessible (arrow keys on the handle).
 */
import Image from "next/image";
import { useRef, useState } from "react";

export function BeforeAfterSlider({ beforeUrl, afterUrl, alt }: { beforeUrl: string; afterUrl: string; alt: string }) {
  const [pos, setPos] = useState(52);
  const ref = useRef<HTMLDivElement>(null);

  const setFromClientX = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <div
      ref={ref}
      className="relative aspect-video w-full cursor-ew-resize select-none overflow-hidden rounded-lg border border-line"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) setFromClientX(e.clientX);
      }}
    >
      <Image src={beforeUrl} alt={`${alt} — before`} fill unoptimized className="object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Image src={afterUrl} alt={`${alt} — after`} fill unoptimized className="object-cover" />
      </div>
      <div
        role="slider"
        aria-label="Before/after divider"
        aria-valuenow={Math.round(pos)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPos((p) => Math.max(2, p - 4));
          if (e.key === "ArrowRight") setPos((p) => Math.min(98, p + 4));
        }}
        className="absolute inset-y-0 z-10 flex w-1 items-center bg-accent"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-bg" />
      </div>
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white">
        before
      </span>
      <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white">
        after
      </span>
    </div>
  );
}
