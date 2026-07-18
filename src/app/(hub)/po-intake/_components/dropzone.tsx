"use client";

/** PO PDF dropzone — PDF only, ≤10 MB; live pipeline progress; elapsed readout. */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export function Dropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [state, setState] = useState<{ phase: "idle" | "running" | "error"; message?: string; startedAt?: number }>({
    phase: "idle",
  });
  const [elapsed, setElapsed] = useState(0);

  const upload = async (file: File) => {
    if (file.type !== "application/pdf") {
      setState({ phase: "error", message: "PDF only." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({ phase: "error", message: "10 MB max." });
      return;
    }
    const startedAt = Date.now();
    setState({ phase: "running", startedAt });
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/workflows/po-intake", { method: "POST", body: form });
      const data = (await res.json()) as { poId?: string; error?: string };
      if (!res.ok || !data.poId) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/po-intake/${data.poId}`);
    } catch (e) {
      setState({ phase: "error", message: e instanceof Error ? e.message : "upload failed" });
    } finally {
      clearInterval(timer);
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer border-dashed p-6 text-center transition-colors",
        drag && "border-accent bg-accent-dim",
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files[0];
        if (file) void upload(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {state.phase === "running" ? (
        <div>
          <p className="font-mono text-sm text-accent status-running">
            extracting · validating seven layers · {(elapsed / 1000).toFixed(1)}s
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">One model call extracts; deterministic code validates.</p>
        </div>
      ) : (
        <div>
          <FileUp className="mx-auto h-5 w-5 text-ink-muted" strokeWidth={1.5} />
          <p className="mt-2 text-[13px] font-medium">Drop a customer PO PDF</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            PDF only, 10 MB max · draft sales order in under 60 seconds, or a precise escalation
          </p>
          {state.phase === "error" ? <p className="mt-1.5 text-[11px] text-danger">{state.message}</p> : null}
        </div>
      )}
    </Card>
  );
}
