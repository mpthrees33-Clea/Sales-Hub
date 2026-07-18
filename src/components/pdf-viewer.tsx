"use client";

/**
 * <PdfViewer /> (docs/03 §3): renders PDF page images client-side via
 * pdfjs-dist with an absolutely-positioned highlight layer driven by
 * {page, bbox?} (bbox = page fractions, top-left origin). Page navigation,
 * fit-width, loading skeleton. WO-06's split view reuses this untouched.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PdfHighlight = { page: number; bbox?: [number, number, number, number] };

export function PdfViewer({
  url,
  highlight,
  className,
  onPageCount,
}: {
  url: string;
  highlight?: PdfHighlight;
  className?: string;
  onPageCount?: (n: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<unknown>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(highlight?.page ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (highlight?.page) setPage(highlight.page);
  }, [highlight?.page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument(url);
        const loaded = await task.promise;
        if (cancelled) return;
        setDoc(loaded);
        setPageCount(loaded.numPages);
        onPageCount?.(loaded.numPages);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed to load PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, onPageCount]);

  const render = useCallback(async () => {
    if (!doc || !canvasRef.current || !containerRef.current) return;
    setRendering(true);
    try {
      const pdfPage = await (doc as any).getPage(page);
      const containerWidth = containerRef.current.clientWidth || 600;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = (containerWidth / base.width) * (window.devicePixelRatio > 1 ? 2 : 1.25);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      setPageDims({ w: viewport.width, h: viewport.height });
    } finally {
      setRendering(false);
    }
  }, [doc, page]);

  useEffect(() => {
    void render();
  }, [render]);

  if (error) {
    return (
      <div className={className}>
        <p className="rounded-md border border-danger/40 bg-danger-dim p-3 text-xs text-danger">
          Could not render PDF: {error}
        </p>
      </div>
    );
  }

  const showHighlight = highlight && highlight.page === page && pageDims;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-ink-faint">
          page {page} / {pageCount || "…"}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-line p-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="rounded-md border border-line p-1 disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div ref={containerRef} className="relative overflow-hidden rounded-md border border-line bg-white">
        {rendering ? <div className="skeleton absolute inset-0 z-10" /> : null}
        <canvas ref={canvasRef} className="block w-full" />
        {showHighlight ? (
          highlight.bbox ? (
            <div
              className="pointer-events-none absolute border-2 border-amber-500 bg-amber-400/20"
              style={{
                left: `${highlight.bbox[0] * 100}%`,
                top: `${highlight.bbox[1] * 100}%`,
                width: `${(highlight.bbox[2] - highlight.bbox[0]) * 100}%`,
                height: `${(highlight.bbox[3] - highlight.bbox[1]) * 100}%`,
              }}
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-amber-400/60" />
          )
        ) : null}
      </div>
    </div>
  );
}
