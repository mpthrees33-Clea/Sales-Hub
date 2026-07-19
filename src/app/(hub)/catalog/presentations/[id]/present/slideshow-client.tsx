"use client";

/** In-app slideshow (WO-10 task 6): keyboard arrows, dark, clean; PDF export. */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Button, Mono } from "@/components/ui";
import type { Slide } from "@/db/schema";
import { exportPresentation } from "../../actions";

export function SlideshowClient({
  presentationId,
  title,
  slides,
  exportedAssetId,
}: {
  presentationId: string;
  title: string;
  slides: Slide[];
  exportedAssetId: string | null;
}) {
  const [idx, setIdx] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(exportedAssetId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setIdx((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  const slide = slides[idx]!;

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/catalog/presentations" className="rounded-md p-1 hover:bg-surface2" aria-label="Back">
            <ArrowLeft className="h-4 w-4 text-ink-muted" />
          </Link>
          <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-faint">
            {idx + 1} / {slides.length} · ← → to navigate
          </span>
          <Button
            onClick={async () => {
              setExporting(true);
              const res = await exportPresentation(presentationId);
              setExported(res.assetId);
              setExporting(false);
            }}
            disabled={exporting}
          >
            <Download className="h-3.5 w-3.5" /> {exporting ? "Exporting…" : exported ? "Re-export PDF" : "Export PDF"}
          </Button>
        </div>
      </div>

      <div
        className="relative flex aspect-video w-full cursor-pointer select-none flex-col justify-center overflow-hidden rounded-lg border border-line bg-bg p-10 sm:p-14"
        onClick={() => setIdx((i) => (i + 1) % slides.length)}
      >
        <span className="absolute left-6 top-5 font-mono text-[10px] tracking-[0.25em] text-ink-faint">
          MERIDIAN SURFACES CO.
        </span>
        {slide.kind === "title" ? (
          <>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">{slide.title}</h2>
            <p className="mt-3 text-sm text-ink-muted">{slide.subtitle}</p>
          </>
        ) : slide.kind === "product" ? (
          <div className="flex items-center gap-10">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">{slide.name}</h2>
              <Mono className="mt-1 block text-[12px] text-ink-muted">
                {slide.sku} · {slide.finish}
              </Mono>
              <ul className="mt-5 space-y-1.5 text-[13px] text-ink-muted sm:text-sm">
                {slide.specLines.map((l, i) => (
                  <li key={i}>· {l}</li>
                ))}
              </ul>
              {slide.talkingPoint ? <p className="mt-4 text-[12px] italic text-ink-faint">“{slide.talkingPoint}”</p> : null}
            </div>
            {slide.sceneBlobUrl ?? slide.swatchBlobUrl ? (
              <Image
                src={slide.sceneBlobUrl ?? slide.swatchBlobUrl!}
                alt={slide.name}
                width={420}
                height={300}
                unoptimized
                className="hidden max-h-[300px] w-2/5 rounded-md border border-line object-cover sm:block"
              />
            ) : null}
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Let&apos;s put it on a wall.</h2>
            <p className="mt-4 text-sm">{slide.repName}</p>
            <p className="text-[12px] text-ink-muted">{slide.company}</p>
            <Mono className="mt-1 block text-[12px] text-ink-muted">
              {slide.repEmail} · {slide.repPhone}
            </Mono>
          </>
        )}
        <span className="absolute bottom-4 right-6 font-mono text-[10px] text-ink-faint">
          {String(idx + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIdx(i)}
            className={`h-1.5 flex-1 rounded-full ${i === idx ? "bg-accent" : "bg-surface2 hover:bg-line-strong"}`}
          />
        ))}
      </div>
      {exported ? (
        <p className="font-mono text-[10px] text-ink-faint">
          Exported deck registered as an attachable asset — it passes the attachment-origin check and can ride any
          email draft.{" "}
          <Link href="/catalog/assets" className="text-accent">
            View in assets →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
