"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Paperclip, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { registerSceneAsAsset } from "../actions";

export function SceneActions({ sceneId, productId, hasOutput }: { sceneId: string; productId: string; hasOutput: boolean }) {
  const [state, setState] = useState<{ phase: "idle" | "busy" | "done" | "error"; assetId?: string; message?: string }>({
    phase: "idle",
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasOutput ? (
        state.phase === "done" ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-ok/40 bg-ok-dim px-3 py-1.5 text-[12px] text-ok">
            <Check className="h-3.5 w-3.5" /> Registered as attachable asset — pick it in any email draft
          </span>
        ) : (
          <Button
            onClick={async () => {
              setState({ phase: "busy" });
              const res = await registerSceneAsAsset(sceneId);
              setState(res.ok ? { phase: "done", assetId: res.assetId } : { phase: "error", message: res.error });
            }}
            disabled={state.phase === "busy"}
          >
            <Paperclip className="h-3.5 w-3.5" /> {state.phase === "busy" ? "Registering…" : "Attach to reply (register as asset)"}
          </Button>
        )
      ) : null}
      <Link
        href={`/scenes/new?product=${productId}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] hover:border-line-strong"
      >
        <RefreshCcw className="h-3.5 w-3.5" /> Regenerate
      </Link>
      {state.phase === "error" ? <span className="text-[11px] text-danger">{state.message}</span> : null}
    </div>
  );
}
