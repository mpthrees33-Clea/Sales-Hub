"use client";

/** Asset upload (pdf/png/jpg only, size-checked server-side; audit-logged). */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui";

export function AssetUpload() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [state, setState] = useState<{ phase: "idle" | "busy" | "error"; message?: string }>({ phase: "idle" });

  const upload = async (file: File) => {
    setState({ phase: "busy" });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title || file.name.replace(/\.[a-z]+$/i, ""));
      form.append("tags", tags);
      const res = await fetch("/api/demo/upload-asset", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTitle("");
      setTags("");
      setState({ phase: "idle" });
      router.refresh();
    } catch (e) {
      setState({ phase: "error", message: e instanceof Error ? e.message : "upload failed" });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line bg-surface p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-48 rounded-md border border-line bg-bg px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
      />
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="tags, comma-separated"
        className="w-48 rounded-md border border-line bg-bg px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <Button onClick={() => fileRef.current?.click()} disabled={state.phase === "busy"}>
        <Upload className="h-3.5 w-3.5" /> {state.phase === "busy" ? "Uploading…" : "Upload asset"}
      </Button>
      <span className="font-mono text-[10px] text-ink-faint">pdf / png / jpg · ≤10 MB · registered + audit-logged</span>
      {state.phase === "error" ? <span className="text-[11px] text-danger">{state.message}</span> : null}
    </div>
  );
}
