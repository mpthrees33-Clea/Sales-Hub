"use client";

/** PO dropzone (WO-06 task 14b) — PDF only, ≤10 MB, checked server-side too. */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const upload = async (file: File) => {
    setError(null);
    if (file.type !== "application/pdf") return setError("PDF only");
    if (file.size > 10 * 1024 * 1024) return setError("File exceeds 10 MB");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/workflows/po-intake", { method: "POST", body: fd });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? `upload failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { poId: string };
      router.push(`/po-intake/${data.poId}`);
    } catch {
      setError("upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void upload(f); }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
        drag ? "border-accent bg-accent-dim" : "border-line bg-surface2/30",
      )}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : <FileUp className="h-5 w-5 text-ink-muted" />}
      <p className="text-[13px] font-medium">{busy ? "Extracting + validating…" : "Drop a purchase-order PDF"}</p>
      <p className="text-[11px] text-ink-muted">PDF only · ≤ 10 MB · runs the seven-layer pipeline</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-1 rounded-md border border-line bg-surface2 px-3 py-1.5 text-[12px] font-medium hover:border-line-strong disabled:opacity-50"
      >
        Choose file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />
      {error ? <p className="mt-1 font-mono text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
