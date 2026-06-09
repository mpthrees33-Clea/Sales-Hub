# Catalogs

A **catalog** is a folder with a `catalog.csv` and the product images it references. It's the
core asset (see `docs/02-architecture.md`) — for now you build it by hand from a few
manufacturers you know; later a crawler keeps it fresh.

## Quick demo (synthetic, runs anywhere)

```bash
python data/make_sample_swatches.py        # writes data/sample_catalog/
streamlit run app/streamlit_app.py
```

Those swatches are **fake** — just enough to exercise the flow. Swap in real products for
anything real.

## catalog.csv format

Header row required. Only `image` must resolve to a real file in the same folder; the rest is
optional (missing `price_per_sqft` / `lead_time_weeks` = "unknown", kept but flagged).

```csv
id,name,manufacturer,image,material,size,finish,color_family,price_per_sqft,lead_time_weeks,source_url
greige_l,Greige Linen 12x24,Acme Stone,greige_l.png,porcelain,12x24,matte,greige,4.20,3,https://...
```

| column | use |
|---|---|
| `id` | stable unique id (defaults to filename) |
| `name`, `manufacturer`, `size` | shown on the result card |
| `image` | filename in this folder (jpg/png/webp) |
| `material`, `finish` | usable as hard filters |
| `color_family` | freeform label (matching uses computed color, not this) |
| `price_per_sqft`, `lead_time_weeks` | hard constraints (budget / lead) |
| `source_url` | the "source" link — proof it's real & current |

## Build a real catalog (~30 min to start)

1. Make a folder, e.g. `data/my_catalog/`.
2. Save product images for a few manufacturers you'd actually spec.
3. Write `catalog.csv` with the columns above (lead times/prices as best you know — that's the
   grind that becomes the moat).
4. In the app sidebar, point **Catalog folder** at `data/my_catalog`.

> Real catalog folders and images are git-ignored (size/copyright). Commit only the generator,
> this README, and your own non-proprietary metadata if you choose.
