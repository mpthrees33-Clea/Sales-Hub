/**
 * Edit-diff recording (WO-03 task 8). Deep-compares the original vs the
 * human-edited proposed_action and returns leaf-level `{path, old, new}`
 * entries, stored in `approvals.edits` — the future tone-tuning signal
 * ("Email Fine-tune" flywheel, docs/02 §3). Pure + unit-tested.
 */
import type { EditDiff } from "@/db/schema";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function joinPath(base: string, key: string | number): string {
  if (typeof key === "number") return `${base}[${key}]`;
  return base ? `${base}.${key}` : key;
}

function walk(oldVal: unknown, newVal: unknown, path: string, out: EditDiff[]): void {
  if (oldVal === newVal) return;

  if (isObject(oldVal) && isObject(newVal)) {
    const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
    for (const k of keys) walk(oldVal[k], newVal[k], joinPath(path, k), out);
    return;
  }

  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    const len = Math.max(oldVal.length, newVal.length);
    for (let i = 0; i < len; i++) walk(oldVal[i], newVal[i], joinPath(path, i), out);
    return;
  }

  // Leaf change (includes type changes, add/remove where one side is undefined).
  out.push({ path: path || "$", old: oldVal ?? null, new: newVal ?? null });
}

export function computeDiff(original: unknown, edited: unknown): EditDiff[] {
  const out: EditDiff[] = [];
  walk(original, edited, "", out);
  return out;
}
