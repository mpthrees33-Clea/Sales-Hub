"use client";

/**
 * "Simulate Overnight" — invokes the REAL nightly workflow against the demo
 * clock (WO-08 wires /api/demo/simulate-overnight; until then the button
 * reports the pending module gracefully). This is what gets filmed.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoonStar } from "lucide-react";
import { Button } from "@/components/ui";

export function SimulateOvernightButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setMessage(null);
    try {
      const res = await fetch("/api/demo/simulate-overnight", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
      setState("idle");
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "simulate failed");
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={run} disabled={state === "running"}>
        <MoonStar className="h-3.5 w-3.5" />
        {state === "running" ? "Running the night…" : "Simulate Overnight"}
      </Button>
      {message ? <span className="text-[10px] text-danger">{message}</span> : null}
    </div>
  );
}
