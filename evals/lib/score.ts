/**
 * Pure scorers for the eval harness — no DB, no model calls, unit-tested in
 * tests/eval-scorers.test.ts. The runners (evals/run-*.ts) produce
 * (expected, actual) pairs; these functions turn them into the numbers.
 */

// ── Triage: classification accuracy + confusion matrix ───────────────────────

export type TriageCaseResult = {
  id: string;
  expected: string;
  /** null ⇒ the run escalated/failed and produced no category. */
  predicted: string | null;
};

export type TriageScore = {
  total: number;
  correct: number;
  accuracy: number;
  /** confusion[expected][predicted] = count (predicted "∅" for no output). */
  confusion: Record<string, Record<string, number>>;
  failures: { id: string; expected: string; predicted: string | null }[];
};

export function scoreTriage(results: TriageCaseResult[]): TriageScore {
  const confusion: Record<string, Record<string, number>> = {};
  const failures: TriageScore["failures"] = [];
  let correct = 0;
  for (const r of results) {
    const predicted = r.predicted ?? "∅";
    confusion[r.expected] ??= {};
    confusion[r.expected]![predicted] = (confusion[r.expected]![predicted] ?? 0) + 1;
    if (r.predicted === r.expected) correct += 1;
    else failures.push({ id: r.id, expected: r.expected, predicted: r.predicted });
  }
  return {
    total: results.length,
    correct,
    accuracy: results.length ? correct / results.length : 0,
    confusion,
    failures,
  };
}

// ── PO extraction: field-level comparison, nulls counted ─────────────────────

type Scalar = string | number | boolean | null;

/**
 * Flatten an extraction into comparable fact fields. Anchors (page/bbox) are
 * layout metadata, not facts — excluded so the score measures WHAT was read,
 * not where the box was drawn.
 */
export function flattenPoValues(extraction: Record<string, unknown>, prefix = ""): Record<string, Scalar> {
  const out: Record<string, Scalar> = {};
  const walk = (node: unknown, path: string) => {
    if (node === null || typeof node !== "object") {
      out[path] = (node ?? null) as Scalar;
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "anchor" || k === "page" || k === "bbox") continue;
      walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(extraction, prefix);
  return out;
}

export type PoFieldOutcome = "correct" | "fabricated" | "missed" | "wrong" | "absent";

export type PoScore = {
  total: number;
  correct: number;
  accuracy: number;
  /** expected null, actual non-null — the model invented a value. */
  fabricated: number;
  /** expected a value, actual null — the model dropped a printed fact. */
  missed: number;
  /** both non-null but different. */
  wrong: number;
  /** field missing entirely from the actual output (schema should prevent this). */
  absent: number;
  /** expected-null fields the model correctly asserted as null. */
  nullsCorrect: number;
  fields: { path: string; outcome: PoFieldOutcome; expected: Scalar; actual: Scalar | undefined }[];
};

export function scorePoExtraction(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): PoScore {
  const exp = flattenPoValues(expected);
  const act = flattenPoValues(actual);
  const fields: PoScore["fields"] = [];
  let correct = 0;
  let fabricated = 0;
  let missed = 0;
  let wrong = 0;
  let absent = 0;
  let nullsCorrect = 0;

  for (const [path, e] of Object.entries(exp)) {
    const a = act[path];
    let outcome: PoFieldOutcome;
    if (!(path in act)) {
      outcome = "absent";
      absent += 1;
    } else if (e === null && a === null) {
      outcome = "correct";
      correct += 1;
      nullsCorrect += 1;
    } else if (e === null && a !== null) {
      outcome = "fabricated";
      fabricated += 1;
    } else if (e !== null && a === null) {
      outcome = "missed";
      missed += 1;
    } else if (a === e) {
      outcome = "correct";
      correct += 1;
    } else {
      outcome = "wrong";
      wrong += 1;
    }
    fields.push({ path, outcome, expected: e, actual: a });
  }

  const total = Object.keys(exp).length;
  return { total, correct, accuracy: total ? correct / total : 0, fabricated, missed, wrong, absent, nullsCorrect, fields };
}
