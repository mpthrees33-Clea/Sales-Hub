"use client";

/** Asset uploader (WO-10 task 4) — pdf/png/jpg, size/type checked server-side. */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Card } from "@/components/ui";

export function AssetUploader() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) return setError("PDF, PNG, or JPG only");
    if (file.size > 20 * 1024 * 1024) return setError("File exceeds 20 MB");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", file.name);
      const res = await fetch("/api/assets", { method: "POST", body: fd });
      if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "upload failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex items-center gap-3 p-3">
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-ink hover:opacity-90 disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload asset
      </button>
      <span className="font-mono text-[10px] text-ink-faint">PDF / PNG / JPG · ≤ 20 MB · becomes email-attachable</span>
      {error ? <span className="font-mono text-[10px] text-danger">{error}</span> : null}
      <input ref={ref} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
    </Card>
  );
}
