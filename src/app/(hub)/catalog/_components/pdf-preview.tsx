"use client";

/** Inline PdfViewer preview modal for library documents. */
import { useState } from "react";
import { Eye, X } from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer";

export function PdfPreviewLink({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 font-mono text-[10px] text-accent hover:opacity-80"
      >
        <Eye className="h-3 w-3" /> preview
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-line bg-surface">
            <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="truncate text-[13px] font-medium">{title}</span>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-surface2">
                <X className="h-4 w-4 text-ink-muted" />
              </button>
            </header>
            <div className="overflow-y-auto p-3">
              <PdfViewer url={url} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
