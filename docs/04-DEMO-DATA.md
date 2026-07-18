# 04 — Demo Data & Seed Engine Specification

> The demo lives or dies on this data. It must be deterministic, internally
> consistent (emails reference real seeded SKUs/projects/people), and staged so
> that "the night before the video" is one command away. WO-01 builds the
> engine; WO-13 does the final polish pass.

---

## 1. Fixed scenario

- **Rep persona**: Cole Mercer, territory rep for **Meridian Surfaces Co.**
  (fictional manufacturer of architectural film & surface finishes).
  TZ America/New_York.
- **Territory**: ~40 fictional accounts across 3 metro clusters (e.g.
  Charlotte / Raleigh / Greensboro — real cities make routes look right, all
  company names fictional): 12 GCs, 10 architecture/design firms,
  8 distributors, 10 facility owners/others. Every account has geo lat/lng,
  1–3 contacts with emails on fictional domains.
- **Catalog**: ~60 SKUs across families — wood grains (Walnut, White Oak,
  Teak…), metals (Brushed Steel, Bronze…), stones/concretes, solids/textures.
  Per SKU: spec (thickness, width, fire rating class, adhesive), swatch image
  (generated flat-color/texture placeholder is fine; a few hero SKUs get real
  generated swatches), 1 PDS PDF + install guide + test report + warranty doc
  (template-generated PDFs with real-looking content), inventory (on-hand,
  lead time), 3 price tiers (list / distributor / project) via price lists.
  **Hero SKU: `MS-WG-1147 "Walnut Grain"`** — used in the room-scene and
  submittal demo beats.
- **Pipeline**: ~25 opportunities incl. stage `specified_bod` examples;
  projects across office TI / hospitality / healthcare; values $8k–$220k;
  8 weeks of won history feeding KPIs.
- **History**: 8 weeks of sales_orders + invoices shaped so weekly/monthly
  KPI tiles show believable pace-vs-target (target: $45k/wk created,
  $40k/wk invoiced; current week ~85% pace — interesting, not sad).
- **Targets**: `targets` rows for created/invoiced, week+month.

## 2. The staged "yesterday + today" (what the nightly run consumes)

Seed sets `demo_state.demo_now` = **Tuesday 6:55 AM**. "Yesterday" (Monday)
contains the unprocessed batch:

**Inbound emails (14 unprocessed, mapped to triage categories):**
1. Quote request — GC needs 3 SKUs for office TI, quantities given (→ quote
   draft w/ stock+pricing) ×2
2. Stock check — distributor asks availability/lead time on 4 SKUs ×2
3. **PO PDF attached** — distributor PO referencing quote #Q-1042, 5 lines,
   one line with a deliberate unit-price mismatch vs price list (validation
   layer 3 catches it → escalation demo) ×1, plus a clean PO used for the
   <60s happy path ×1
4. Sample requests (Walnut Grain + 2 others, designer) ×2
5. Submittal request — GC needs package for "Harborview Medical Ph2" ×1
6. Scheduling — reschedule ask that touches today's docket ×1
7. General/technical question (fire rating) ×1
8. Noise — newsletters/vendor spam ×3 (triage archives, visibly)

**Monday's meetings**: 2 completed, one with a pre-baked diarized transcript
(site walk at "Harborview Medical" — customer asks for Walnut Grain pricing,
2 PDS docs, and mentions a Phase 3 opportunity → feeds opportunity-update +
follow-up-draft demo).

**Sent-mail corpus**: ~30 outbound emails from Cole — consistent voice
(concise, warm, signs "—Cole", references lead times, uses "I'll get that
over to you"), used by WO-04 for the tone style-profile.

**Today (Tuesday)**: 3 meetings with geo (route demo: office TI walkthrough
9:30, distributor lunch 12:00, design-firm presentation 15:00) + prep notes.

## 3. Nightly-run expected outputs (assert these in tests)

After Simulate Overnight on the seed: 14 triaged (3 archived noise), approval
queue contains ≈ 2 quote drafts, 2 stock-check replies, 2 sample-order
confirmations (low tier, batch-approvable), 1 scheduling reply, 1 technical
reply, 1 clean PO → validated draft SO (7/7 layers), 1 escalated PO (layer 3
price mismatch), 3 opportunity updates w/ field diffs (incl. new Phase 3 opp
proposal from the transcript), 1 morning brief. Deterministic *counts* (LLM
text varies; structure must not).

## 4. Engine requirements (WO-01)

- `pnpm seed` — idempotent, fixed faker seed, truncate+rebuild, uploads fixture
  blobs (PDFs, audio, images) once and reuses; `pnpm seed --reset-day` returns
  `demo_state` to Tue 6:55 AM without touching history (film-day reset).
- Fixtures in `src/db/seed/fixtures/`: email bodies (hand-written, referencing
  real seeded SKUs/projects — no lorem), transcript JSON, PO PDFs (2,
  generated with a real PDF lib so extraction is honest), PDS/doc PDFs
  (templated per SKU), audio file for the meeting demo (any clear 2-min
  recording), 2 pre-generated room scenes for hero moments.
- Content-consistency rule: **any SKU, person, project, price, or quote number
  mentioned in any fixture must exist in the DB** — write a seed-time
  consistency check that fails loudly if not.
- All fake domains use `.example.com`-style TLDs reserved for demos; the
  policy-gate allowlist derives from seeded contacts.
