"""CLIP image embeddings for pattern / look / movement similarity.

CPU is fine for a few hundred images. First load downloads the weights (~600MB).
"""
from __future__ import annotations

import numpy as np
from PIL import Image

MODEL_NAME = "clip-ViT-B-32"


def load_model(name: str = MODEL_NAME):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(name)


def embed_images(model, images: list[Image.Image]) -> np.ndarray:
    vecs = model.encode(
        [im.convert("RGB") for im in images], normalize_embeddings=True
    )
    return np.asarray(vecs, dtype=float)
