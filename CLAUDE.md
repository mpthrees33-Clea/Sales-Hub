# CLAUDE.md — Context handoff

> Read this first. It tells you (Claude Code, in the terminal) what this project is,
> who the founder is, what we've decided, and exactly where we left off.

## What this is

Working codename: **Or-Equal** (placeholder — "or-equal" is the industry term for an
approved spec substitute; rename whenever the founder picks a brand).

An AI platform for the **commercial architecture & design (A&D) finish-spec workflow**.
Two features that are really one platform sharing one core asset (a structured, freshly
maintained product index of commercial finishes — tile, stone, LVT, architectural finish
films, etc.):

1. **Alternate Finder ("or-equal" engine)** — a designer uploads a specified product that
   is discontinued or has an unacceptable lead time. The system finds *verified, available,
   in-budget* substitutes that match on the attributes designers actually care about
   (color/LRV, pattern, finish, size, performance ratings), and explains *why* each matches.
2. **Visualizer** — renders the real product (the original or the chosen alternate) onto the
   client's actual space (photo) or drawing (elevation), faithfully, so the designer can
   confirm the look before specifying.

End-to-end loop: **specified product → discontinued / long lead → find verified or-equals in
budget & lead time → render the winner into the real project → confirm and spec.**

## Who the founder is (constraints that shape decisions)

- Commercial flooring sales rep with deep tile/finish domain knowledge and live A&D /
  manufacturer / distributor **relationships** — the real moat.
- MBA + business background. ~4 months of hands-on learning building agents / agent harnesses.
- **1–2 months of runway. Wants to replace income and quit ASAP.** Optimize for fastest path
  to paying customers, not a polished platform.
- Beachhead = the current job's network. First customers should come from warm A&D /
  distributor / manufacturer contacts, not cold marketing.

## Core strategic bets (the "why")

- **Don't fight Roomvo** (Leap Tools) or TilesView/Wizart/Viz2D head-on. Those are *retail*
  texture-overlay widgets for homeowners on a flooring retailer's website. Our wedge is the
  **commercial A&D spec channel**: walls + complex layouts + architectural finish films +
  rendering onto drawings + the **rep/designer as the user**, fast enough for a live
  lunch-and-learn or design meeting.
- **The data is the moat, not the AI.** A fresh, structured commercial-finish index (with
  lead times and availability) is annoying to build and maintain — which is exactly why it's
  defensible. Founder's domain knowledge makes the index *correct* (what's a real substitute).
- **Use the right tool for each job** (see Architecture). Most "it doesn't work" pain so far
  came from asking a *generative* model to do *retrieval/judgment* work.
- **Business model = two-sided, Material-Bank-style:** *free for designers, manufacturers pay.*
  Designers are demand we aggregate; **the founder is himself the demand-side distribution** (he
  sits with design firms weekly → we skip the expensive marketplace cold-start). Manufacturers
  buy inclusion + verified-partner status + spec-intent data/leads + a clearly-labeled
  "discontinuation placement" — **never** pay-to-play ranking that displaces a better match
  (designer trust is the product). The marketplace is the END STATE, not the runway-saver:
  bridge with a concierge service + one launch-partner manufacturer. See `docs/04-go-to-market.md`.

## Key technical decisions made so far

- **Visual similarity is a RETRIEVAL problem, not generative.** Decompose "looks similar" into
  measurable parts: color via **CIELAB ΔE (CIEDE2000)** + **LRV**, pattern/veining via **image
  embeddings (CLIP) + nearest-neighbor**, finish/format from extracted metadata. Combine with
  tunable weights. Explainable scores ("ΔE 2.1, same matte finish") = designer trust.
- **Off-the-shelf embeddings ~75%.** Cold-start with CLIP + color science; turn every designer
  thumbs-up/down into a training label → fine-tune later. The feedback loop is the data moat.
- **Generative model's real job:** (a) faithful **visualization** (Gemini image models —
  default `gemini-3-pro-image-preview` / Nano Banana Pro for fidelity), (b) **creative
  cross-material substitutions** layered on top of retrieval (e.g. porcelain that mimics a
  discontinued honed limestone, in stock, rated for commercial floor traffic).
- **Catalog freshness = scheduled crawler** with per-manufacturer adapters + an LLM-extraction
  fallback for messy sites/PDFs; weekly/biweekly diff to catch discontinued series, dropped
  sizes, and new products. Ongoing maintenance load is expected and accepted.

## Two make-or-break spikes (de-risk BEFORE building the platform)

Both live in `spikes/`. Each is cheap (~an afternoon + a few $ of compute/API) and decides
whether the scary part is actually hard.

1. **`spikes/visual-similarity/`** — does off-the-shelf CLIP + ΔE color matching surface
   designer-acceptable look-alikes from a folder of product images, with ZERO fine-tuning?
   If yes, the hardest-feeling part is largely solved.
2. **`spikes/render-fidelity/`** — can Gemini place a *real* tile (from a product photo) onto a
   wall/floor (and an elevation) with correct perspective, scale, grout, and pattern, WITHOUT
   hallucinating the design? If yes, we have a visualizer nobody in commercial has.

## Current state (what's built)

- **Designer MVP app exists** (`app/streamlit_app.py`) over the **`orequal/`** package:
  upload product → hard-filter catalog (budget/lead/material) → rank survivors by look
  (CLIP pattern + ΔE/LRV color) → optionally render a pick into a space/elevation (Gemini).
- **Catalog = a folder + `catalog.csv`** (`data/README.md`). `data/make_sample_swatches.py`
  generates a synthetic demo catalog so the app runs on a fresh clone.
- Core pipeline verified end-to-end headlessly (generator → load → filter → rank). CLIP/Gemini
  paths weren't run here (heavy deps / need API key) but are wired and syntax-clean.

## Where we left off / next steps

- [ ] **Run the app** (`streamlit run app/streamlit_app.py`) — first real local run with CLIP
      installed; confirm the demo flow, then point it at a hand-built real catalog.
- [ ] **Seed a real catalog** from 3–5 manufacturers the founder knows (`data/README.md`).
- [ ] Get it in front of the founder's own designers (free) — Phase 1 of GTM.
- [ ] Run the two **spikes** on real images to tune defaults (weights, ΔE scale) and confirm
      render fidelity / decide pure-generative vs. hybrid. Record in `docs/decision-log.md`.
- [ ] Name the first **launch-partner manufacturer** + first **designer beachhead** firm.
- [ ] Instrument usage events (surfaced-as-or-equal, searched-but-missing) — the data we sell.

## Repo map

- `docs/00-vision.md` — the problem, the wedge, why now.
- `docs/01-product.md` — the two features as one platform; user stories.
- `docs/02-architecture.md` — the system, tool-for-each-job, data pipeline.
- `docs/03-spikes.md` — what we're testing and the pass/fail bar.
- `docs/04-go-to-market.md` — who pays first, pricing, runway-aware sequencing.
- `docs/05-roadmap.md` — 6-week plan and beyond.
- `docs/06-launch-partner-onepager.md` — manufacturer pitch leave-behind (fill in brackets).
- `docs/decision-log.md` — running log of decisions + spike results. **Append here.**
- `orequal/` — core package (color, embedding, catalog, matching, render).
- `app/streamlit_app.py` — designer-facing app.
- `data/` — catalog format + demo-catalog generator (`make_sample_swatches.py`).
- `requirements.txt` — app deps. `spikes/` — the de-risking experiments.

## Working notes for future-Claude

- Keep optimizing for **fastest paying pilot**, given the runway. Prefer a manual/scrappy
  version of any step over a polished build until a customer has paid.
- When in doubt on "can AI do X here," ask: is this *generation* or *retrieval/verification*?
  Route accordingly.
- Verify current Gemini image model IDs against Google's docs before shipping — they change
  (`gemini-2.5-flash-image`, `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`).
