# Evals — measured, not vibes

Unit tests prove the *code* works; evals measure whether the *model* is right.
This directory holds golden datasets and runners that score the two agents
where correctness is measurable ground truth, not taste.

## What's measured

| Eval | Agent | Metric | Golden set |
|---|---|---|---|
| `pnpm eval:triage` | email-triage | classification accuracy + confusion matrix | `golden/triage.json` — 14 seeded fixture emails (labels from the demo-day contract) + 6 adversarial inline cases (prompt injection, keyword traps, unknown-sender PO, signal-only-in-body) |
| `pnpm eval:po` | po-intake | field-level extraction accuracy, **nulls counted** | `golden/po-extraction.json` — seeded PO PDFs vs their seed-time ground-truth extractions (generated from the exact pdf-lib draw positions) |

The PO scorer separates failure modes the way an architect should:

- **fabricated** — expected `null`, model produced a value (invented a fact)
- **missed** — expected a value, model asserted `null` (dropped a printed fact)
- **wrong** — both non-null, values differ
- **nullsCorrect** — absent facts the model correctly asserted as `null`
  (this is what the required-but-nullable schema design is for)

## Modes

- **Live** (`AI_GATEWAY_API_KEY` set): the real model runs through the real
  harness — submit_result structured output, repair loop, the works. These are
  the numbers that matter.
- **Demo** (no key): the same runners execute through the same harness, but
  the deterministic demo scripts answer. Reports are stamped
  `"demoMode": true` with a warning — useful as harness smoke, never quoted
  as model accuracy.

## Reports

Each run writes `reports/<eval>-<date>.json`: model id, mode, aggregate
scores, per-case breakdowns, and the confusion matrix (triage). The report
JSON is the contract the clea-solutions.ai case study reads — publish numbers
from a live run only.

## Adding cases

- Triage: append to `golden/triage.json`. `source: "seed"` references a
  fixture key from `src/db/seed/fixtures/emails.ts`; `source: "inline"`
  carries the email and is inserted/cleaned up by the runner.
- PO: add a fixture PO in the seed (so ground truth is generated, not
  hand-typed), then reference its blob URLs.

Scorers are pure functions in `lib/score.ts`, unit-tested in
`tests/eval-scorers.test.ts`.
