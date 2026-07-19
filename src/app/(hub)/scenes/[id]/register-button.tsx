"use client";

/** Register-as-asset button (WO-11 task 6) — makes the scene attachable to a reply. */
import { useState, useTransition } from "react";
import { Check, Loader2, Paperclip } from "lucide-react";
import { registerSceneAssetAction } from "../actions";

export function RegisterAssetButton({ sceneId, initiallyRegistered, disabled }: { sceneId: string; initiallyRegistered: boolean; disabled?: boolean }) {
  const [registered, setRegistered] = useState(initiallyRegistered);
  const [pending, startTransition] = useTransition();

  const register = () =>
    startTransition(async () => {
      await registerSceneAssetAction(sceneId);
      setRegistered(true);
    });

  if (registered) {
    return <span className="inline-flex items-center gap-1 rounded-md border border-ok/40 bg-ok-dim px-3 py-1.5 font-mono text-[11px] text-ok"><Check className="h-3.5 w-3.5" /> attachable</span>;
  }
  return (
    <button type="button" onClick={register} disabled={pending || disabled} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-ink hover:opacity-90 disabled:opacity-50">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Attach to reply
    </button>
  );
}
