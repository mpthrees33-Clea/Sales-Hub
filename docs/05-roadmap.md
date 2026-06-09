# 05 — Roadmap

Runway-aware. The goal of the next 6 weeks is **one paid pilot**, not a finished platform.

## Phase 0 — De-risk (this week)

- [ ] Run **Spike 1** (visual similarity) on ~200 real product images. Record in decision log.
- [ ] Run **Spike 2** (render fidelity) with a real tile + photo + elevation. Record results.
- [ ] Decide: pure-generative vs. hybrid render; embedding-only vs. fine-tune for matching.
- [ ] In parallel: pick the **one warm contact** for a first pilot conversation.

## Phase 1 — Scrappy MVP the founder can demo (wks 2–3)

- [x] Wire the spike engines into one flow: input product → filtered, ranked alternates → render.
      (`orequal/` package + `app/streamlit_app.py`, runnable via Streamlit.)
- [x] Demo catalog generator so it runs on a fresh clone (`data/make_sample_swatches.py`).
- [ ] Seed a tiny **real** product index by hand from 3–5 manufacturers (no crawler yet).
- [ ] Run it live on a real account; capture the designer's reaction.

## Phase 2 — First paid pilot (wks 4–6)

- [ ] Add the single feature that made people lean in (e.g. elevation input, or board export).
- [ ] Close one paid pilot (manufacturer/distributor preferred — see GTM).
- [ ] Stand up the verification step properly (cite sources; never show unverifiable stock).

## Phase 3 — Make it real (post-pilot)

- [ ] Scheduled catalog crawler + diff (per-manufacturer adapters + LLM fallback) with a review
      queue.
- [ ] Vector store + structured store at modest scale (FAISS/pgvector + Postgres).
- [ ] Feedback capture (👍/👎) → first embedding fine-tune.
- [ ] Thin web UI once a paying customer asks for self-serve.

## Later / maybe

- Multi-trade expansion beyond flooring/tile (the original "automate commercial spec" thesis).
- Submittal/substitution-request document generation.
- Manufacturer-facing analytics ("how often you're surfaced as the or-equal").

## North star metric

Time + confidence from "this product won't work" → "verified alternate I can see and spec."
Everything above serves that.
