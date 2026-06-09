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

## Where we left off / next steps

- [ ] Founder to run **visual-similarity spike** on ~200 real product images + 1 discontinued
      tile. Eyeball top-5. (See `spikes/visual-similarity/README.md`.)
- [ ] Founder to run **render-fidelity spike** with a real tile + space photo + an elevation.
      (Needs `GEMINI_API_KEY`. See `spikes/render-fidelity/README.md`.)
- [ ] Record results in `docs/decision-log.md` (template entry already stubbed).
- [ ] Based on spike results, pick MVP shape: pure-generative vs. hybrid render; embedding-only
      vs. embedding+fine-tune for matching.
- [ ] Identify 1 warm manufacturer/distributor for a paid pilot (fastest cash — see
      `docs/04-go-to-market.md`).

## Repo map

- `docs/00-vision.md` — the problem, the wedge, why now.
- `docs/01-product.md` — the two features as one platform; user stories.
- `docs/02-architecture.md` — the system, tool-for-each-job, data pipeline.
- `docs/03-spikes.md` — what we're testing and the pass/fail bar.
- `docs/04-go-to-market.md` — who pays first, pricing, runway-aware sequencing.
- `docs/05-roadmap.md` — 6-week plan and beyond.
- `docs/06-launch-partner-onepager.md` — manufacturer pitch leave-behind (fill in brackets).
- `docs/decision-log.md` — running log of decisions + spike results. **Append here.**
- `spikes/` — runnable de-risking experiments.

## Working notes for future-Claude

- Keep optimizing for **fastest paying pilot**, given the runway. Prefer a manual/scrappy
  version of any step over a polished build until a customer has paid.
- When in doubt on "can AI do X here," ask: is this *generation* or *retrieval/verification*?
  Route accordingly.
- Verify current Gemini image model IDs against Google's docs before shipping — they change
  (`gemini-2.5-flash-image`, `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`).
