# Or-Equal *(working name)*

AI for the **commercial A&D finish-spec workflow**. Two features, one platform:

1. **Alternate Finder** — specified product discontinued or long lead time? Find verified,
   available, in-budget "or-equal" substitutes that match on color/LRV, pattern, finish, size,
   and performance — with an explanation of *why* each matches.
2. **Visualizer** — render the real product (original or alternate) onto the client's actual
   space or elevation, faithfully, before specifying it.

> Both share one core asset: a fresh, structured index of commercial finishes. That index —
> not the AI — is the moat.

## Run the designer app

```bash
pip install -r requirements.txt
python data/make_sample_swatches.py     # demo catalog (synthetic) so it runs out of the box
streamlit run app/streamlit_app.py
```

Upload a product → get verified, in-budget, in-lead-time look-alikes ranked by look →
optionally render a pick into a space photo or elevation (needs `GEMINI_API_KEY`).
Point the sidebar **Catalog folder** at your own products — format in `data/README.md`.

## Start here

- **`CLAUDE.md`** — full context handoff (read first if you're picking this up).
- **`docs/`** — vision, product, architecture, go-to-market, roadmap, decision log, pitch.
- **`orequal/`** — core package: color science, CLIP embeddings, catalog, matching, render.
- **`app/`** — the Streamlit designer app.
- **`spikes/`** — the two experiments that de-risked the engines.

## Status

Pre-MVP. Validating the two highest-risk assumptions via the spikes in `spikes/`. See
`docs/05-roadmap.md` and the "Where we left off" section of `CLAUDE.md`.
