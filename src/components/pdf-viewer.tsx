"use client";

/**
 * <PdfViewer /> — renders a PDF page (pdf.js) from a Blob URL with an absolutely
 * positioned highlight layer driven by `{page, bbox?}`: a bounding box when the
 * evidence ref carries one, a whole-page wash until WO-06 supplies field→bbox
 * anchors. Contract created in WO-03; WO-06 reuses it untouched. Degrades to a
 * "open PDF" link if rendering is unavailable.
 */
import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

type Bbox = [number, number, number, number];

export function PdfViewer({ blobUrl, page = 1, bbox }: { blobUrl: string; page?: number; bbox?: Bbox }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const doc = await pdfjs.getDocument({ url: blobUrl }).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        const pg = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        const viewport = pg.getViewport({ scale: 1.25 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setDims({ w: viewport.width, h: viewport.height });
        await pg.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blobUrl, page]);

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-line bg-surface2 px-4 py-8 text-center">
        <FileText className="h-5 w-5 text-ink-muted" />
        <p className="text-xs text-ink-muted">Preview unavailable in this view.</p>
        <a href={blobUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-accent hover:underline">
          Open PDF · page {page}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative mx-auto w-fit rounded-md border border-line bg-white">
        {status === "loading" ? <div className="skeleton h-[520px] w-[420px]" /> : null}
        <canvas ref={canvasRef} className={status === "ready" ? "block max-w-full" : "hidden"} />
        {status === "ready" && dims.w > 0 ? (
          <div
            className="pointer-events-none absolute border-2 border-accent bg-accent/15"
            style={
              bbox
                ? { left: bbox[0] * dims.w, top: bbox[1] * dims.h, width: (bbox[2] - bbox[0]) * dims.w, height: (bbox[3] - bbox[1]) * dims.h }
                : { inset: 0 }
            }
            aria-hidden
          />
        ) : null}
      </div>
      <p className="text-center font-mono text-[10px] text-ink-faint">
        page {page} / {pageCount}
      </p>
    </div>
  );
}
