"use client";

/** Simulate Overnight (WO-08 task 4) — runs the real nightly workflow on demand. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Moon } from "lucide-react";
import { Button } from "@/components/ui";

export function SimulateOvernightButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setNote(null);
      const res = await fetch("/api/demo/simulate-overnight", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { processed?: number; note?: string };
      setNote(data.note ?? `processed ${data.processed ?? 0} emails`);
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      <Button variant="primary" onClick={run} disabled={pending}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Moon className="h-3.5 w-3.5" />} Simulate Overnight
      </Button>
      {note ? <span className="font-mono text-[10px] text-ink-faint">{note}</span> : null}
    </div>
  );
}
