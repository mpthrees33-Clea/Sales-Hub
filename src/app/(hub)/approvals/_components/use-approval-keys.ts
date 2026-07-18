"use client";

/**
 * Keyboard map (docs/03 §4, WO-03 task 4): j/k next/prev · a approve · e edit ·
 * r reject · enter open evidence · shift+A batch · ? legend. Keys are inert
 * while an input/textarea is focused; in edit mode only ⌘/Ctrl+Enter
 * (save-and-approve) and Esc (cancel) are live. Latest handlers are read from a
 * ref so the listener binds once.
 */
import { useEffect, useRef } from "react";

export type ApprovalKeyHandlers = {
  onNext: () => void;
  onPrev: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onEnter: () => void;
  onBatch: () => void;
  onLegend: () => void;
  onSave: () => void;
  onCancel: () => void;
  editing: boolean;
  enabled: boolean;
};

export function useApprovalKeys(handlers: ApprovalKeyHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      if (!h.enabled) return;

      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      if (h.editing) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          h.onSave();
        } else if (e.key === "Escape") {
          e.preventDefault();
          h.onCancel();
        }
        return; // all other keys inert while editing
      }

      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          h.onNext();
          break;
        case "k":
          e.preventDefault();
          h.onPrev();
          break;
        case "a":
          e.preventDefault();
          h.onApprove();
          break;
        case "e":
          e.preventDefault();
          h.onEdit();
          break;
        case "r":
          e.preventDefault();
          h.onReject();
          break;
        case "Enter":
          e.preventDefault();
          h.onEnter();
          break;
        case "A":
          if (e.shiftKey) {
            e.preventDefault();
            h.onBatch();
          }
          break;
        case "?":
          e.preventDefault();
          h.onLegend();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
