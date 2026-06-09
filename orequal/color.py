"""Color science: dominant color, LRV, and CIEDE2000 deltaE.

Designers trust numbers (LRV, deltaE) far more than a black-box "looks similar",
so color matching is computed, not guessed.
"""
from __future__ import annotations

import numpy as np
from PIL import Image


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = np.asarray(c, dtype=float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def dominant_rgb(img: Image.Image, palette_size: int = 5) -> np.ndarray:
    """Most common color via palette quantization (robust to noise/JPEG)."""
    small = img.convert("RGB").resize((128, 128))
    pal = small.quantize(colors=palette_size, method=Image.Quantize.FASTOCTREE)
    counts = pal.getcolors()
    if not counts:
        return np.array(small).reshape(-1, 3).mean(axis=0)
    _, idx = max(counts, key=lambda t: t[0])
    palette = pal.getpalette()
    return np.array(palette[idx * 3 : idx * 3 + 3], dtype=float)


def lrv(rgb: np.ndarray) -> float:
    """Light Reflectance Value (0-100): relative luminance of a color."""
    lin = srgb_to_linear(rgb)
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    return round(float(y) * 100.0, 1)


def delta_e(rgb_a: np.ndarray, rgb_b: np.ndarray) -> float:
    """CIEDE2000 color difference between two sRGB colors (~2.3 = just noticeable)."""
    from skimage.color import deltaE_ciede2000, rgb2lab

    lab_a = rgb2lab(np.asarray(rgb_a, dtype=float).reshape(1, 1, 3) / 255.0)
    lab_b = rgb2lab(np.asarray(rgb_b, dtype=float).reshape(1, 1, 3) / 255.0)
    return float(deltaE_ciede2000(lab_a, lab_b)[0, 0])
