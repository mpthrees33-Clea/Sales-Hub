/**
 * Human-edit diff recording (WO-03 task 8). Deep-compares the original vs
 * edited proposed_action into [{path, old, new}] entries — stored on
 * approvals.edits. This is also the future fine-tune dataset (docs/02 §3).
 */
import type { EditDiff } from "@/db/schema";

export function diffProposedAction(original: unknown, edited: unknown, basePath = ""): EditDiff[] {
  if (deepEqual(original, edited)) return [];

  const bothObjects =
    original !== null &&
    edited !== null &&
    typeof original === "object" &&
    typeof edited === "object" &&
    Array.isArray(original) === Array.isArray(edited);

  if (!bothObjects) {
    return [{ path: basePath || "$", old: original, new: edited }];
  }

  const diffs: EditDiff[] = [];
  if (Array.isArray(original) && Array.isArray(edited)) {
    const max = Math.max(original.length, edited.length);
    for (let i = 0; i < max; i++) {
      diffs.push(...diffProposedAction(original[i], edited[i], `${basePath}[${i}]`));
    }
    return diffs;
  }

  const keys = new Set([...Object.keys(original as object), ...Object.keys(edited as object)]);
  for (const key of keys) {
    const o = (original as Record<string, unknown>)[key];
    const e = (edited as Record<string, unknown>)[key];
    diffs.push(...diffProposedAction(o, e, basePath ? `${basePath}.${key}` : key));
  }
  return diffs;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}
