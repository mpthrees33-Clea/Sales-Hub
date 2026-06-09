"""Product model + catalog loading.

A catalog is a folder containing `catalog.csv` and the product images it references.
catalog.csv columns (header row required):

    id,name,manufacturer,image,material,size,finish,color_family,price_per_sqft,lead_time_weeks,source_url

Only `image` must resolve to a real file in the folder; everything else is optional.
Missing price / lead_time are treated as "unknown" (kept, but flagged downstream).
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from .color import dominant_rgb, lrv

_BLANK = {"", "na", "n/a", "none", "null", "-"}


@dataclass
class Product:
    id: str
    name: str
    manufacturer: str
    image_path: Path
    material: str = ""
    size: str = ""
    finish: str = ""
    color_family: str = ""
    source_url: str = ""
    price_per_sqft: float | None = None
    lead_time_weeks: float | None = None
    # computed at load:
    dominant_rgb: np.ndarray | None = None
    lrv: float | None = None
    embedding: np.ndarray | None = None


def _to_float(s: str | None) -> float | None:
    s = (s or "").strip()
    if s.lower() in _BLANK:
        return None
    try:
        return float(s.replace("$", "").replace(",", ""))
    except ValueError:
        return None


def load_catalog(catalog_dir: str | Path) -> list[Product]:
    catalog_dir = Path(catalog_dir)
    csv_path = catalog_dir / "catalog.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"No catalog.csv in {catalog_dir}")

    products: list[Product] = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            img = catalog_dir / (row.get("image") or "").strip()
            if not img.exists():
                continue
            try:
                with Image.open(img) as im:
                    rgb = dominant_rgb(im)
            except Exception:
                continue
            products.append(
                Product(
                    id=(row.get("id") or img.stem).strip(),
                    name=(row.get("name") or img.stem).strip(),
                    manufacturer=(row.get("manufacturer") or "").strip(),
                    image_path=img,
                    material=(row.get("material") or "").strip(),
                    size=(row.get("size") or "").strip(),
                    finish=(row.get("finish") or "").strip(),
                    color_family=(row.get("color_family") or "").strip(),
                    source_url=(row.get("source_url") or "").strip(),
                    price_per_sqft=_to_float(row.get("price_per_sqft")),
                    lead_time_weeks=_to_float(row.get("lead_time_weeks")),
                    dominant_rgb=rgb,
                    lrv=lrv(rgb),
                )
            )
    return products


def compute_embeddings(products: list[Product], model) -> list[Product]:
    """Populate .embedding for each product (batched)."""
    from .embedding import embed_images

    if not products:
        return products
    imgs = [Image.open(p.image_path) for p in products]
    vecs = embed_images(model, imgs)
    for p, v in zip(products, vecs):
        p.embedding = v
    return products
