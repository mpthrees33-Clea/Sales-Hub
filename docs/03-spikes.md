# 03 — De-risking spikes

Before building the platform, prove the two scariest assumptions. Each is cheap (an afternoon +
a few dollars) and has a clear pass/fail bar. Record results in `docs/decision-log.md`.

## Spike 1 — Visual similarity (the part that *felt* hardest)

**Question:** With ZERO fine-tuning, do off-the-shelf image embeddings + color (ΔE/LRV) surface
**designer-acceptable** look-alikes from a real product image set?

**Setup:** ~200 real product images in a folder + 1 discontinued tile as the query.
Run `spikes/visual-similarity/`.

**Pass bar:** At least one genuinely usable substitute appears in the **top 5** for most
queries, and the explainable scores (ΔE/LRV) track the founder's professional judgment.

**Outcomes:**
- **Pass** → matching is largely solved off-the-shelf; invest in the *index/data*, not ML.
- **Partial** → keep off-the-shelf for v1, plan a fine-tune using collected 👍/👎 labels.
- **Fail** → revisit preprocessing (swatch segmentation, lighting normalization) and weights
  before concluding anything; raw manufacturer photos are noisy.

## Spike 2 — Render fidelity (the visualizer's whole bet)

**Question:** Can a generative image model place a **specific real tile** (from a product photo)
onto (a) a space photo and (b) an elevation/drawing with correct perspective, scale, grout, and
pattern — **without reinventing the design**?

**Setup:** 1 real tile image + 1 room/wall photo + 1 elevation. Needs `GEMINI_API_KEY`.
Run `spikes/render-fidelity/`.

**Pass bar:** The rendered surface is recognizably the *same product* (color/grout/pattern
intact), placed believably. A designer would show it to a client.

**Outcomes:**
- **Pass** → pure-generative visualizer is viable; build the thin tool.
- **Partial/Fail** → go **hybrid**: generative for relight/perspective + controlled texture
  overlay for the true product. Still a product, just more engineering.

## What we are NOT testing yet (assumed tractable, defer)

- Lead-time/availability data gathering (founder will grind this; it's data, not research risk).
- Crawler maintenance at scale.
- Fine-tuning the embedding model.
- Any UI.
