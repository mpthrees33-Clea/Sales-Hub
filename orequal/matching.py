"""Hard-constraint filtering + explainable visual ranking.

Two stages, deliberately separate:
  1) filter_products(): hard gates a designer can't violate (budget, lead time, material).
  2) rank(): order the survivors by *look*, combining pattern (CLIP) and color (deltaE).

Ranking is merit-based on match quality only. (Any future paid placement must be a
separate, clearly-labeled layer — never a thumb on this scale. See docs/04.)
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image

from .catalog import Product
from .color import delta_e, dominant_rgb
from .embedding import embed_images

DEFAULT_DELTAE_SCALE = 30.0  # deltaE mapped to color_sim 0; lower = stricter color match


@dataclass
class Match:
    product: Product
    pattern_sim: float  # 0..1 CLIP cosine (look / veining / movement)
    color_sim: float    # 0..1 from deltaE
    delta_e: float      # raw CIEDE2000
    score: float        # weighted blend

    @property
    def lead_unknown(self) -> bool:
        return self.product.lead_time_weeks is None

    @property
    def price_unknown(self) -> bool:
        return self.product.price_per_sqft is None


def filter_products(
    products: list[Product],
    max_price: float | None = None,
    max_lead_weeks: float | None = None,
    material: str | None = None,
    finish: str | None = None,
) -> list[Product]:
    """Apply hard gates. Unknown price/lead is KEPT (flagged later, not silently dropped)."""
    out = []
    for p in products:
        if material and material.lower() not in (p.material or "").lower():
            continue
        if finish and finish.lower() not in (p.finish or "").lower():
            continue
        if max_price is not None and p.price_per_sqft is not None and p.price_per_sqft > max_price:
            continue
        if max_lead_weeks is not None and p.lead_time_weeks is not None and p.lead_time_weeks > max_lead_weeks:
            continue
        out.append(p)
    return out


def rank(
    query_img: Image.Image,
    model,
    products: list[Product],
    w_pattern: float = 0.6,
    w_color: float = 0.4,
    deltae_scale: float = DEFAULT_DELTAE_SCALE,
) -> list[Match]:
    if not products:
        return []
    q_vec = embed_images(model, [query_img])[0]
    q_rgb = dominant_rgb(query_img)

    matches: list[Match] = []
    for p in products:
        if p.embedding is None or p.dominant_rgb is None:
            continue
        pattern_sim = float(np.dot(q_vec, p.embedding))  # normalized -> cosine
        de = delta_e(q_rgb, p.dominant_rgb)
        color_sim = 1.0 - min(de / deltae_scale, 1.0)
        score = w_pattern * pattern_sim + w_color * color_sim
        matches.append(Match(p, pattern_sim, color_sim, de, score))

    matches.sort(key=lambda m: m.score, reverse=True)
    return matches
