"use client";

/** Client slideshow (WO-10 tasks 5–6) — arrow-key nav + export-to-attachable-PDF. */
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import type { Slide } from "@/db/schema";
import { exportPresentationAction } from "../../actions";

export function Deck({ id, title, slides, exported }: { id: string; title: string; slides: Slide[]; exported: boolean }) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState(exported);
  const [pending, startTransition] = useTransition();
  const last = slides.length - 1;

  const go = useCallback((d: number) => setI((n) => Math.min(last, Math.max(0, n + d))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const exportPdf = () =>
    startTransition(async () => {
      await exportPresentationAction(id);
      setDone(true);
    });

  const slide = slides[i];

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/catalog/presentations" className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> presentations</Link>
          <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
        </div>
        <button
          type="button"
          onClick={exportPdf}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface2 px-3 py-1.5 text-[12px] font-medium hover:border-line-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {done ? "Re-export PDF" : "Export PDF"}
        </button>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-surface">
        {slide ? <SlideView slide={slide} /> : null}
        <button type="button" aria-label="Previous slide" onClick={() => go(-1)} disabled={i === 0} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-line bg-surface2/80 p-1.5 backdrop-blur hover:border-line-strong disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Next slide" onClick={() => go(1)} disabled={i === last} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-line bg-surface2/80 p-1.5 backdrop-blur hover:border-line-strong disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-ink-faint">← → to navigate{done ? " · exported to Assets" : ""}</span>
        <span className="font-mono text-[10px] text-ink-muted">{i + 1} / {slides.length}</span>
      </div>
    </div>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  if (slide.kind === "title") {
    return (
      <div className="flex h-full flex-col justify-center px-12">
        <div className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">Presentation</div>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight">{slide.title}</h2>
        <p className="mt-3 text-sm text-ink-muted">{slide.subtitle}</p>
      </div>
    );
  }
  if (slide.kind === "closing") {
    return (
      <div className="flex h-full flex-col justify-center px-12">
        <h2 className="text-3xl font-semibold tracking-tight">Let&apos;s build it.</h2>
        <div className="mt-4 space-y-0.5 text-sm">
          <div className="font-medium">{slide.repName}</div>
          <div className="text-ink-muted">{slide.repEmail}</div>
          <div className="font-mono text-[12px] text-ink-muted">{slide.repPhone}</div>
        </div>
        <div className="mt-4 font-mono text-[11px] text-ink-faint">{slide.company}</div>
      </div>
    );
  }
  return (
    <div className="grid h-full grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col justify-center gap-3 px-10">
        <div>
          <div className="font-mono text-[11px] text-ink-faint">{slide.sku}</div>
          <h2 className="text-3xl font-semibold tracking-tight">{slide.name}</h2>
          <div className="mt-1 text-[13px] text-ink-muted">{slide.finish}</div>
        </div>
        <ul className="space-y-1 text-[12px] text-ink">
          {slide.specLines.map((l) => <li key={l} className="flex gap-2"><span className="text-ink-faint">·</span>{l}</li>)}
        </ul>
        {slide.talkingPoint ? <p className="mt-1 text-[12px] italic text-ink-muted">{slide.talkingPoint}</p> : null}
      </div>
      <div className="relative border-l border-line bg-surface2">
        <SlideImage slide={slide} />
      </div>
    </div>
  );
}

function SlideImage({ slide }: { slide: Extract<Slide, { kind: "product" }> }) {
  const src = slide.sceneBlobUrl ?? slide.swatchBlobUrl;
  if (!src) return <div className="flex h-full items-center justify-center font-mono text-[10px] text-ink-faint">no image</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`${slide.name} preview`} className="h-full w-full object-cover" />;
}
