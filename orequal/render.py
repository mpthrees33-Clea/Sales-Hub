"""Faithful product-on-surface visualization via Gemini image models.

Prompt is engineered for FIDELITY: apply the EXACT product, never reinvent the pattern.
Model IDs drift -- verify against https://ai.google.dev/gemini-api/docs/image-generation
  gemini-3-pro-image-preview     (Nano Banana Pro)  default, best fidelity
  gemini-3.1-flash-image-preview (Nano Banana 2)    faster/cheaper drafts
  gemini-2.5-flash-image         (Nano Banana)      original
"""
from __future__ import annotations

import os
from io import BytesIO

from PIL import Image

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-pro-image-preview")

PROMPT_PHOTO = (
    "You are a commercial interior finish visualizer. The FIRST image is a real product "
    "(tile/stone/finish) to be installed. The SECOND image is the target space.\n"
    "Apply the EXACT product from the first image onto the {surface} in the second image.\n"
    "CRITICAL: preserve the product's real color, grout lines, texture, veining and pattern "
    "exactly as shown -- do NOT invent, restyle, or beautify the pattern. Match real-world "
    "tile scale and lay the product in correct perspective for the surface. Keep the rest of "
    "the scene unchanged. Relight the applied product to match the scene's lighting. Output a "
    "single photorealistic image."
)
PROMPT_ELEVATION = (
    "You are a commercial interior finish visualizer. The FIRST image is a real product "
    "(tile/stone/finish). The SECOND image is a 2D architectural elevation/drawing.\n"
    "Render the EXACT product from the first image onto the {surface} indicated in the "
    "elevation, as a realistic material fill that respects the drawing's proportions.\n"
    "CRITICAL: preserve the product's real color, grout, texture and pattern exactly -- do NOT "
    "reinvent it. Keep correct tile scale. Leave annotations and other surfaces intact. Output "
    "a single clear image."
)


def render_on_surface(
    product_img: Image.Image,
    surface_img: Image.Image,
    surface_type: str = "photo",
    surface_name: str = "floor",
    extra: str | None = None,
    model: str = DEFAULT_MODEL,
    api_key: str | None = None,
) -> tuple[Image.Image | None, str]:
    """Returns (rendered_image_or_None, model_text_note)."""
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set (https://aistudio.google.com/apikey).")

    from google import genai
    from google.genai import types

    base = PROMPT_ELEVATION if surface_type == "elevation" else PROMPT_PHOTO
    prompt = base.format(surface=surface_name)
    if extra:
        prompt += "\nAdditional instruction: " + extra

    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=model,
        contents=[product_img.convert("RGB"), surface_img.convert("RGB"), prompt],
        config=types.GenerateContentConfig(
            response_modalities=[types.Modality.TEXT, types.Modality.IMAGE]
        ),
    )

    out_img, note = None, ""
    for part in resp.candidates[0].content.parts:
        if getattr(part, "text", None):
            note += part.text
        elif getattr(part, "inline_data", None):
            out_img = Image.open(BytesIO(part.inline_data.data))
    return out_img, note
