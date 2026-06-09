#!/usr/bin/env python3
"""
Visual-similarity spike for the Or-Equal alternate finder.

Question this answers: with ZERO fine-tuning, do off-the-shelf image embeddings
(CLIP) + color science (CIELAB deltaE + LRV) surface designer-acceptable tile/finish
look-alikes from a folder of product images?

Usage:
    python similarity_spike.py --query path/to/discontinued_tile.jpg \
                               --candidates path/to/product_images/ \
                               --top 5 \
                               --w-pattern 0.6 --w-color 0.4 \
                               --out results.report.html

Outputs a ranked list to the console and (optionally) a self-contained HTML report
with thumbnails so a designer can eyeball the matches.

Scoring (all 0..1, higher = more similar):
    pattern_sim  = cosine similarity of CLIP image embeddings (veining/movement/look)
    color_sim    = 1 - min(deltaE2000 / DELTAE_SCALE, 1)   (perceptual color match)
    score        = w_pattern * pattern_sim + w_color * color_sim

We also report raw deltaE and LRV (light reflectance value) because those are numbers
a designer trusts far more than a black-box "looks similar".
"""
from __future__ import annotations

import argparse
import base64
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

# deltaE below which colors read as "the same" tends to be ~1-3 (JND ~2.3).
# We scale so deltaE ~= DELTAE_SCALE maps to color_sim 0. 30 is a forgiving default
# for "same color family"; tighten toward 10-15 for strict color matching.
DELTAE_SCALE = 30.0

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


# --------------------------------------------------------------------------- color
def _srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def dominant_rgb(img: Image.Image, palette_size: int = 5) -> np.ndarray:
    """Most common color via palette quantization (dependency-light, robust)."""
    small = img.convert("RGB").resize((128, 128))
    pal = small.quantize(colors=palette_size, method=Image.Quantize.FASTOCTREE)
    color_counts = pal.getcolors()  # list of (count, palette_index)
    if not color_counts:
        return np.array(small).reshape(-1, 3).mean(axis=0)
    _, idx = max(color_counts, key=lambda t: t[0])
    palette = pal.getpalette()  # flat [r,g,b, r,g,b, ...]
    r, g, b = palette[idx * 3 : idx * 3 + 3]
    return np.array([r, g, b], dtype=float)


def lrv(rgb: np.ndarray) -> float:
    """Light Reflectance Value (0-100): relative luminance of a color."""
    lin = _srgb_to_linear(np.asarray(rgb, dtype=float))
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    return round(float(y) * 100.0, 1)


def delta_e(rgb_a: np.ndarray, rgb_b: np.ndarray) -> float:
    """CIEDE2000 color difference between two sRGB colors."""
    from skimage.color import deltaE_ciede2000, rgb2lab

    lab_a = rgb2lab(np.asarray(rgb_a, dtype=float).reshape(1, 1, 3) / 255.0)
    lab_b = rgb2lab(np.asarray(rgb_b, dtype=float).reshape(1, 1, 3) / 255.0)
    return float(deltaE_ciede2000(lab_a, lab_b)[0, 0])


# ----------------------------------------------------------------------- embeddings
def load_embedder():
    """CLIP image embedder via sentence-transformers. CPU is fine for a few hundred."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("clip-ViT-B-32")


def embed(model, images: list[Image.Image]) -> np.ndarray:
    vecs = model.encode([im.convert("RGB") for im in images], normalize_embeddings=True)
    return np.asarray(vecs, dtype=float)


# ---------------------------------------------------------------------------- model
@dataclass
class Candidate:
    path: Path
    pattern_sim: float
    color_sim: float
    deltaE: float
    lrv: float
    score: float


def find_images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_EXTS)


def rank(query_path: Path, candidate_paths: list[Path], w_pattern: float,
         w_color: float) -> list[Candidate]:
    model = load_embedder()

    q_img = Image.open(query_path)
    q_vec = embed(model, [q_img])[0]
    q_rgb = dominant_rgb(q_img)

    cand_imgs = [Image.open(p) for p in candidate_paths]
    c_vecs = embed(model, cand_imgs)

    results: list[Candidate] = []
    for path, img, vec in zip(candidate_paths, cand_imgs, c_vecs):
        pattern_sim = float(np.dot(q_vec, vec))  # already normalized -> cosine
        de = delta_e(q_rgb, dominant_rgb(img))
        color_sim = 1.0 - min(de / DELTAE_SCALE, 1.0)
        score = w_pattern * pattern_sim + w_color * color_sim
        results.append(Candidate(path, pattern_sim, color_sim, de, lrv(dominant_rgb(img)), score))

    results.sort(key=lambda c: c.score, reverse=True)
    return results


# --------------------------------------------------------------------------- report
def _thumb_data_uri(path: Path, size: int = 220) -> str:
    from io import BytesIO

    img = Image.open(path).convert("RGB")
    img.thumbnail((size, size))
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def write_html(query_path: Path, results: list[Candidate], out: Path, top: int) -> None:
    q_lrv = lrv(dominant_rgb(Image.open(query_path)))
    cards = []
    for i, c in enumerate(results[:top], 1):
        cards.append(f"""
        <div class="card">
          <div class="rank">#{i}</div>
          <img src="{_thumb_data_uri(c.path)}" />
          <div class="name">{c.path.name}</div>
          <div class="metrics">
            <b>score {c.score:.3f}</b><br/>
            pattern {c.pattern_sim:.3f} &middot; color {c.color_sim:.3f}<br/>
            &Delta;E {c.deltaE:.1f} &middot; LRV {c.lrv}
          </div>
        </div>""")
    html = f"""<!doctype html><meta charset="utf-8">
<title>Or-Equal similarity spike</title>
<style>
 body{{font-family:system-ui,sans-serif;margin:24px;background:#fafafa}}
 .q{{display:flex;gap:16px;align-items:center;margin-bottom:24px}}
 .q img{{width:220px;border-radius:8px}}
 .grid{{display:flex;flex-wrap:wrap;gap:16px}}
 .card{{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:12px;width:240px}}
 .card img{{width:100%;border-radius:6px}}
 .rank{{font-weight:700;color:#888}}
 .name{{font-size:12px;word-break:break-all;margin:6px 0;color:#444}}
 .metrics{{font-size:13px;color:#333}}
</style>
<h1>Or-Equal — visual similarity spike</h1>
<div class="q">
  <img src="{_thumb_data_uri(query_path)}"/>
  <div><h2>Query (discontinued product)</h2>
  <div>{query_path.name} &middot; LRV {q_lrv}</div></div>
</div>
<h2>Top {top} candidate alternates</h2>
<div class="grid">{''.join(cards)}</div>
"""
    out.write_text(html, encoding="utf-8")


# ------------------------------------------------------------------------------ cli
def main() -> int:
    ap = argparse.ArgumentParser(description="Visual-similarity spike (CLIP + deltaE).")
    ap.add_argument("--query", required=True, type=Path, help="Discontinued product image.")
    ap.add_argument("--candidates", required=True, type=Path, help="Folder of product images.")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--w-pattern", type=float, default=0.6, help="Weight on look/pattern.")
    ap.add_argument("--w-color", type=float, default=0.4, help="Weight on color (deltaE).")
    ap.add_argument("--out", type=Path, default=None, help="Optional HTML report path.")
    args = ap.parse_args()

    if not args.query.exists():
        print(f"Query image not found: {args.query}", file=sys.stderr)
        return 1
    candidate_paths = find_images(args.candidates)
    if not candidate_paths:
        print(f"No images found under {args.candidates}", file=sys.stderr)
        return 1
    print(f"Embedding 1 query + {len(candidate_paths)} candidates "
          f"(weights: pattern={args.w_pattern}, color={args.w_color})...")

    results = rank(args.query, candidate_paths, args.w_pattern, args.w_color)

    print(f"\nTop {args.top} matches:")
    print(f"{'#':>2}  {'score':>6}  {'pat':>5}  {'col':>5}  {'dE':>5}  {'LRV':>5}  name")
    for i, c in enumerate(results[: args.top], 1):
        print(f"{i:>2}  {c.score:>6.3f}  {c.pattern_sim:>5.3f}  {c.color_sim:>5.3f}  "
              f"{c.deltaE:>5.1f}  {c.lrv:>5}  {c.path.name}")

    if args.out:
        write_html(args.query, results, args.out, args.top)
        print(f"\nWrote report: {args.out}  (open it in a browser)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
