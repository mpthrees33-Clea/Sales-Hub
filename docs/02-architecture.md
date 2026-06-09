# 02 — Architecture

Guiding principle: **use the right tool for each job.** Most early "AI can't do this" pain came
from asking a *generative* model to do *retrieval / verification / judgment* work. Route each
sub-problem correctly:

| Sub-problem | WRONG tool | RIGHT tool |
|---|---|---|
| "Find a product that looks like this" | LLM generates an answer (hallucinates SKUs) | **Embeddings + nearest-neighbor over a real index** |
| "Same color?" | eyeballing / chat | **CIELAB ΔE (CIEDE2000) + LRV** (computed) |
| "Is it available in 4 weeks?" | model's memory | **Live verification agent** against source pages |
| "Extract spec from this cut sheet" | regex | **Vision LLM → structured schema** ✅ good fit |
| "Render this tile onto this wall" | overlay warp only | **Generative image model** (Gemini) |
| "Creative cross-material idea" | retrieval only | **LLM reasoning on top of retrieval** ✅ |

## System overview

```
                        ┌─────────────────────────────────────────┐
                        │            PRODUCT INDEX (the moat)       │
                        │  structured specs + image embeddings +    │
                        │  color (LAB/LRV) + availability/lead time │
                        └───────────────▲───────────────┬──────────┘
                                        │ writes        │ reads
        ┌───────────────────────────────┘               │
        │  CATALOG PIPELINE                              │
        │  scheduled crawler → per-mfr adapters +        │
        │  LLM-extraction fallback → weekly/biweekly     │
        │  diff (discontinued / dropped size / new)      │
        └────────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │ ALTERNATE FINDER              │              VISUALIZER         │
        │ 1 spec extraction (vision LLM)│  product img + surface/elevation│
        │ 2 hybrid retrieval:           │            │                    │
        │    hard filters (size/lead/$) │            ▼                    │
        │    + embedding similarity     │  Gemini image model (faithful   │
        │    + color ΔE/LRV             │  product application)           │
        │ 3 verification agent (cite)   │            │                    │
        │ 4 rank + LLM "why" + creative │            ▼                    │
        └───────────────┬───────────────┘     render + export board      │
                        │                                                 │
                        └──────────► designer picks → Visualizer ─────────┘
```

## The product index (core asset)

Per product: manufacturer, series, SKU, **material**, **nominal size(s)**, **finish**, color
fields (**dominant LAB**, **LRV**, palette), **image embedding vector**, performance ratings
(PEI/DCOF/fire/etc.), price tier, **availability + lead time**, source URL, last-verified date.

- **Structured store** for hard filters (size/lead/budget/ratings) + **vector store** for
  embedding similarity. Hybrid query = filter then rank by similarity.

## Catalog pipeline (freshness)

- **Scheduled** (weekly/biweekly) crawl of a founder-curated manufacturer list.
- **Per-manufacturer adapters** for the big, predictable sites; **general LLM-extraction
  fallback** for messy/JS/PDF sources.
- **Diff** against last snapshot → flag discontinued series, dropped sizes/finishes, new
  products. Human-in-the-loop review queue at first.
- Reality: adapters break when sites change → small permanent maintenance load. Accepted; it's
  the moat.

## Visual similarity (decomposed, explainable)

`score = w_pattern · embed_similarity + w_color · color_similarity (+ metadata gates)`

- **Pattern/movement:** CLIP-style image embeddings, cosine similarity, ANN search.
- **Color:** dominant color → CIELAB → **ΔE (CIEDE2000)**; also report **LRV**.
- **Finish / format:** gates/weights from extracted metadata.
- **Tunable weights** per query ("color is non-negotiable, veining doesn't matter").
- **Cold-start:** off-the-shelf embeddings (~75%) + color science. **Feedback loop:** every
  designer 👍/👎 is a label → fine-tune the embedding later. The labels are the data moat.
- **Preprocessing:** segment/isolate the material swatch from room scenes, normalize lighting
  before embedding (manufacturer photos are inconsistent).

## Visualization (generative)

- Gemini image models; default **`gemini-3-pro-image-preview`** (Nano Banana Pro) for fidelity;
  cheaper `gemini-2.5-flash-image` / `gemini-3.1-flash-image-preview` for drafts.
- Prompt discipline: keep the EXACT product from the reference image; apply to the target
  surface; correct perspective/scale/grout/lighting; do **not** reinvent the pattern.
- Open risk (see spike): fidelity to a *specific* SKU. If pure-generative drifts, go **hybrid**
  (model for relight/perspective, controlled overlay for the true texture).

## Suggested stack (lean, revisit after spikes)

- Python core. Embeddings via `sentence-transformers` (CLIP) or a hosted embedding API.
- Color via `scikit-image` (LAB + ΔE). Vector search: start with in-memory / FAISS / pgvector.
- Structured data: SQLite/Postgres. Crawler: Playwright + LLM extraction fallback.
- Gemini via `google-genai`. Thin web UI later (only once a customer wants it).
