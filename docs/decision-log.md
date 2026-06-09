# Decision log

Append-only running record of decisions and spike results. Newest at top. Future-Claude and
future-you both read this to know *why* things are the way they are.

---

## 2026-06-09 — Built the designer MVP (Streamlit app + `orequal/` package)

- Productized the spike logic into **`orequal/`** (color, embedding, catalog, matching, render)
  and a **Streamlit app** (`app/streamlit_app.py`): upload → hard-filter (budget/lead/material)
  → rank by look (CLIP + ΔE/LRV) → optional Gemini render into a space/elevation.
- **Catalog = folder + `catalog.csv`**; `data/make_sample_swatches.py` makes a synthetic demo
  catalog so it runs on a clean clone. Real/proprietary catalogs are git-ignored.
- **Decision:** ranking stays merit-only; any future paid placement is a separate labeled layer
  (enforced by keeping `filter`/`rank` free of any sponsor signal).
- Verified end-to-end headlessly (generator → load → filter → rank with stubbed embeddings).
  Querying "Greige Linen" correctly returned the other greige first (ΔE 4) and dropped
  over-budget / long-lead items. CLIP + Gemini paths wired but not run here.

### NEXT (open)
- [ ] First real local run with CLIP installed; tune default weights / ΔE scale on real images.
- [ ] Hand-seed a real catalog (3–5 manufacturers) and demo to a real designer.

---

## 2026-06-09 — Business model chosen: two-sided (Material-Bank-style)

- **Decision:** free for designers, **manufacturers pay**. Designers = demand we aggregate, not
  the side we bill.
- **Key insight:** the founder *is* the demand-side distribution (rep who sits with design firms
  weekly) → we skip the marketplace cold-start that normally needs heavy VC.
- **Guardrail:** never sell pay-to-play ranking that displaces a better match. Sell inclusion,
  verified-partner status, spec-intent data/leads, and clearly-labeled "discontinuation
  placement." Designer trust is the product.
- **Runway guardrail:** the marketplace is the end state, NOT the near-term cash. Bridge with a
  concierge service + one launch-partner manufacturer so we don't starve before the flywheel
  spins.
- Rewrote `docs/04-go-to-market.md` to this model.

### NEXT (open)
- [ ] Name the most likely **launch-partner manufacturer** (warm contact).
- [ ] Name the first **free-designer beachhead** firm(s) (founder's own accounts).
- [ ] Decide the comfortable line on "labeled placement" (trust).

---

## 2026-06-09 — Project framing & first plan

- Defined the platform: **Alternate Finder + Visualizer** as one product over a shared,
  freshly-maintained **commercial-finish product index**.
- **Decision:** do NOT compete with Roomvo/retail visualizers; target the **commercial A&D
  spec channel** (walls, finish films, elevations, rep/designer as user).
- **Decision:** treat visual similarity as a **retrieval** problem (embeddings + ΔE/LRV),
  reserve generative models for **visualization** and **creative substitutions**.
- **Decision:** the **data/index is the moat**; freshness via scheduled crawler is an accepted
  ongoing cost.
- **Decision:** GTM = warm relationships first; **manufacturer/distributor pilot** is the
  fastest cash; service-before-software is the runway fallback.
- Scaffolded two de-risking spikes (`spikes/visual-similarity`, `spikes/render-fidelity`).
- Default Gemini image model: `gemini-3-pro-image-preview` (verify ID before shipping).

### NEXT (open)
- [ ] Run Spike 1; paste top-5 results / verdict below.
- [ ] Run Spike 2; paste render verdict below.
- [ ] Name the first warm pilot contact.

---

## Spike results (fill in)

### Spike 1 — visual similarity
- Date:
- Image set (count, manufacturers):
- Query product:
- Top-5 usable? (Y/N + notes):
- Did ΔE/LRV track your judgment?:
- **Verdict:** pass / partial / fail →

### Spike 2 — render fidelity
- Date:
- Model used:
- Photo result (faithful? show a client?):
- Elevation result:
- **Verdict:** pure-generative / go hybrid →
