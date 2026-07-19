"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { recomputeTodayRoute } from "./actions";

export function RecomputeButton({ roundTrip, excludeStopIds }: { roundTrip: boolean; excludeStopIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await recomputeTodayRoute({ roundTrip, excludeStopIds });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] text-ink-muted hover:border-line-strong hover:text-ink disabled:opacity-50"
    >
      <RefreshCcw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Recomputing…" : "Recompute"}
    </button>
  );
}
