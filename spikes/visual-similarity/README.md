# Spike 1 — Visual similarity

**Decides:** is the "find a look-alike" part solvable off-the-shelf, or does it need a fine-tune?

This treats similarity as **retrieval** (not generation): CLIP image embeddings for
pattern/movement + CIELAB **ΔE (CIEDE2000)** and **LRV** for color. It ranks a folder of
product images against one discontinued product and prints explainable scores.

## Run it

```bash
cd spikes/visual-similarity
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python similarity_spike.py \
  --query    inputs/discontinued_tile.jpg \
  --candidates inputs/product_images/ \
  --top 5 \
  --out results.report.html
```

Open `results.report.html` in a browser to eyeball the top matches with thumbnails.

## Getting the test data (~30 min)

1. Pick **one discontinued tile/finish** you know well = the query.
2. Save **~200 product images** from a few manufacturers you'd actually consider as alternates
   into `inputs/product_images/` (filenames don't matter; `.jpg/.png/.webp` etc).
3. Put the query image at `inputs/discontinued_tile.jpg`.

> `inputs/` and `*.report.html` are git-ignored — we don't commit image sets.

## Reading the output

| Column | Meaning |
|---|---|
| `score` | weighted blend (default 60% pattern / 40% color) |
| `pat` | CLIP cosine similarity (look / veining / movement), 0..1 |
| `col` | color match from ΔE, 0..1 (1 = identical color) |
| `dE` | raw CIEDE2000 color difference (≈0 identical, ≈2.3 just-noticeable) |
| `LRV` | light reflectance value of the candidate's dominant color (0–100) |

Tune to your judgment: `--w-color 0.7 --w-pattern 0.3` if color is the dealbreaker.

## Pass/fail (record in `docs/decision-log.md`)

- **Pass:** a usable substitute lands in the **top 5** for most queries, and ΔE/LRV track your
  professional eye → matching is largely solved; invest in the *data/index*, not ML.
- **Partial:** good but noisy → ship off-the-shelf for v1, fine-tune later on collected 👍/👎.
- **Fail:** before concluding, try isolating the swatch (crop out room scenes) and
  re-running — raw manufacturer photos are noisy and preprocessing matters.
