"""Generate a tiny demo catalog so the app runs end-to-end on a fresh clone.

These are synthetic color/pattern swatches — NOT real products. They exist only to
exercise the upload -> filter -> rank -> visualize flow. Replace data/sample_catalog/
with real product images + a real catalog.csv for anything meaningful.

    python data/make_sample_swatches.py
"""
from __future__ import annotations

import csv
import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent / "sample_catalog"

# (id, name, manufacturer, base_rgb, pattern, material, size, finish, color_family, price, lead)
SWATCHES = [
    ("greige_l", "Greige Linen 12x24", "Acme Stone", (196, 188, 172), "speckle",
     "porcelain", "12x24", "matte", "greige", 4.20, 3),
    ("warm_grey", "Warm Grey Concrete 24x24", "Northwind", (170, 165, 158), "noise",
     "porcelain", "24x24", "matte", "grey", 5.10, 2),
    ("travertine", "Ivory Travertine 18x18", "Cava", (212, 200, 176), "veined",
     "porcelain", "18x18", "honed", "cream", 6.75, 6),
    ("charcoal", "Charcoal Slate 12x24", "Northwind", (78, 80, 84), "noise",
     "porcelain", "12x24", "textured", "charcoal", 4.95, 4),
    ("sand_wood", "Sand Oak Plank 8x48", "Timberline", (190, 168, 132), "grain",
     "lvt", "8x48", "matte", "tan", 3.40, 1),
    ("greige_d", "Greige Stone 12x24", "Cava", (182, 174, 160), "speckle",
     "porcelain", "12x24", "matte", "greige", 5.60, 8),
    ("white_marble", "Bianco Marble 24x24", "Cava", (232, 230, 226), "veined",
     "porcelain", "24x24", "polished", "white", 8.20, 10),
    ("graphite", "Graphite Concrete 24x48", "Acme Stone", (96, 98, 102), "noise",
     "porcelain", "24x48", "matte", "charcoal", 6.30, 5),
    ("taupe_lin", "Taupe Linen 12x24", "Northwind", (176, 162, 144), "speckle",
     "porcelain", "12x24", "matte", "taupe", 4.05, 2),
    ("walnut", "Walnut Plank 7x48", "Timberline", (120, 92, 64), "grain",
     "lvt", "7x48", "matte", "brown", 3.80, 3),
]


def draw_swatch(rgb, pattern, size=512) -> Image.Image:
    img = Image.new("RGB", (size, size), rgb)
    d = ImageDraw.Draw(img)
    rng = random.Random(sum(rgb) + len(pattern))

    def jitter(amt):
        return tuple(max(0, min(255, c + rng.randint(-amt, amt))) for c in rgb)

    if pattern == "speckle":
        for _ in range(2200):
            x, y = rng.randint(0, size), rng.randint(0, size)
            d.ellipse([x, y, x + 3, y + 3], fill=jitter(28))
    elif pattern == "noise":
        for _ in range(6000):
            x, y = rng.randint(0, size), rng.randint(0, size)
            d.point((x, y), fill=jitter(18))
    elif pattern == "veined":
        for _ in range(14):
            pts = [(rng.randint(0, size), rng.randint(0, size)) for _ in range(4)]
            d.line(pts, fill=jitter(40), width=rng.randint(1, 4))
    elif pattern == "grain":
        for y in range(0, size, 3):
            d.line([(0, y), (size, y)], fill=jitter(16), width=1)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for (pid, name, mfr, rgb, pattern, material, sz, finish, fam, price, lead) in SWATCHES:
        fname = f"{pid}.png"
        draw_swatch(rgb, pattern).save(OUT / fname)
        rows.append({
            "id": pid, "name": name, "manufacturer": mfr, "image": fname,
            "material": material, "size": sz, "finish": finish, "color_family": fam,
            "price_per_sqft": price, "lead_time_weeks": lead,
            "source_url": "https://example.com/" + pid,
        })

    cols = ["id", "name", "manufacturer", "image", "material", "size", "finish",
            "color_family", "price_per_sqft", "lead_time_weeks", "source_url"]
    with open(OUT / "catalog.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} demo swatches + catalog.csv to {OUT}")
    print("Now run:  streamlit run app/streamlit_app.py")


if __name__ == "__main__":
    main()
