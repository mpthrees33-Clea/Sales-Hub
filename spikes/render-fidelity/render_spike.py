#!/usr/bin/env python3
"""
Render-fidelity spike for the Or-Equal visualizer.

Question this answers: can a generative image model place a SPECIFIC real tile/finish
(from a product photo) onto a target surface (a space photo OR an elevation/drawing)
with correct perspective, scale, grout, and pattern -- WITHOUT reinventing the design?

Uses the Gemini image models via the google-genai SDK.
  - gemini-3-pro-image-preview   (Nano Banana Pro)  <- default, best fidelity
  - gemini-3.1-flash-image-preview (Nano Banana 2)  <- faster/cheaper drafts
  - gemini-2.5-flash-image         (Nano Banana)     <- original
Model IDs change -- verify against https://ai.google.dev/gemini-api/docs/image-generation

Setup:
    export GEMINI_API_KEY=...        # from https://aistudio.google.com/apikey
    pip install -r requirements.txt

Usage:
    python render_spike.py --product tile.jpg --surface room.jpg --out render.png
    python render_spike.py --product tile.jpg --surface elevation.png --surface-type elevation
    python render_spike.py --product tile.jpg --surface wall.jpg --prompt "apply to the back wall only"
"""
from __future__ import annotations

import argparse
import os
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-pro-image-preview")

# Prompt is engineered for FIDELITY: keep the exact product, don't reinvent it.
PROMPT_PHOTO = (
    "You are a commercial interior finish visualizer. The FIRST image is a real product "
    "(tile/stone/finish) to be installed. The SECOND image is the target space.\n"
    "Apply the EXACT product from the first image onto the {surface} in the second image.\n"
    "CRITICAL: preserve the product's real color, grout lines, texture, veining and pattern "
    "exactly as shown -- do NOT invent, restyle, or beautify the pattern. Match real-world "
    "tile scale and lay the product in correct perspective for the surface. Keep the rest of "
    "the scene (furniture, lighting, fixtures, other surfaces) unchanged. Relight the applied "
    "product to match the scene's existing lighting. Output a single photorealistic image."
)
PROMPT_ELEVATION = (
    "You are a commercial interior finish visualizer. The FIRST image is a real product "
    "(tile/stone/finish). The SECOND image is a 2D architectural elevation/drawing.\n"
    "Render the EXACT product from the first image onto the {surface} indicated in the "
    "elevation, as a realistic material fill that respects the drawing's proportions and "
    "dimensions.\n"
    "CRITICAL: preserve the product's real color, grout, texture and pattern exactly -- do NOT "
    "reinvent it. Keep correct tile scale relative to the drawing. Leave annotations, "
    "dimensions and other surfaces intact. Output a single clear image."
)


def load_image_part(path: Path) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGB")


def main() -> int:
    ap = argparse.ArgumentParser(description="Render-fidelity spike (Gemini image).")
    ap.add_argument("--product", required=True, type=Path, help="Real product/tile image.")
    ap.add_argument("--surface", required=True, type=Path, help="Space photo or elevation.")
    ap.add_argument("--surface-type", choices=["photo", "elevation"], default="photo")
    ap.add_argument("--surface-name", default="floor",
                    help="Which surface to apply to, e.g. 'floor', 'back wall', 'feature wall'.")
    ap.add_argument("--prompt", default=None, help="Override / append extra instruction.")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--out", type=Path, default=Path("render.png"))
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Set GEMINI_API_KEY (https://aistudio.google.com/apikey).", file=sys.stderr)
        return 1

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("pip install -r requirements.txt  (need google-genai)", file=sys.stderr)
        return 1

    base = PROMPT_ELEVATION if args.surface_type == "elevation" else PROMPT_PHOTO
    prompt = base.format(surface=args.surface_name)
    if args.prompt:
        prompt += "\nAdditional instruction: " + args.prompt

    product = load_image_part(args.product)
    surface = load_image_part(args.surface)

    print(f"Model: {args.model}\nApplying {args.product.name} -> "
          f"{args.surface.name} ({args.surface_type}: {args.surface_name})...")

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=args.model,
        contents=[product, surface, prompt],
        config=types.GenerateContentConfig(
            response_modalities=[types.Modality.TEXT, types.Modality.IMAGE]
        ),
    )

    saved = False
    for part in response.candidates[0].content.parts:
        if getattr(part, "text", None):
            print("Model note:", part.text)
        elif getattr(part, "inline_data", None):
            Image.open(BytesIO(part.inline_data.data)).save(args.out)
            print(f"Saved render: {args.out}")
            saved = True
    if not saved:
        print("No image returned -- check the model ID and that it supports image output.",
              file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
