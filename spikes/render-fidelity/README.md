# Spike 2 — Render fidelity

**Decides:** can a generative model place a *specific real product* onto a surface faithfully —
or do we need a hybrid (generative relight/perspective + controlled texture overlay)?

Uses Gemini image models via `google-genai`. The prompt is engineered for **fidelity**: keep
the exact product, don't reinvent the pattern.

## Run it

```bash
cd spikes/render-fidelity
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export GEMINI_API_KEY=...        # https://aistudio.google.com/apikey

# Onto a real space photo (e.g. the floor):
python render_spike.py --product inputs/tile.jpg --surface inputs/room.jpg \
  --surface-name floor --out outputs/render_photo.png

# Onto a wall:
python render_spike.py --product inputs/tile.jpg --surface inputs/lobby.jpg \
  --surface-name "feature wall" --out outputs/render_wall.png

# Onto an elevation/drawing (the differentiator vs. retail tools):
python render_spike.py --product inputs/tile.jpg --surface inputs/elevation.png \
  --surface-type elevation --surface-name "back wall" --out outputs/render_elev.png
```

## Models (verify IDs before shipping — they change)

| Model ID | a.k.a. | Use |
|---|---|---|
| `gemini-3-pro-image-preview` | Nano Banana Pro | **default**, best fidelity |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | faster/cheaper drafts |
| `gemini-2.5-flash-image` | Nano Banana | original |

Override with `--model ...` or `GEMINI_MODEL=...`. Docs:
https://ai.google.dev/gemini-api/docs/image-generation

## What to judge (record in `docs/decision-log.md`)

1. Is the rendered surface **recognizably the same product** (color, grout, pattern, scale)?
2. Is the placement believable (perspective, lighting)?
3. Did the rest of the scene stay intact?
4. **Would you show it to a client?**

- **Pass** (faithful + believable) → pure-generative visualizer is viable; build the thin tool.
- **Partial/Fail** (drifts, reinvents the pattern, wrong scale) → go **hybrid**: generative for
  perspective/relight + controlled overlay for the true texture. Still shippable, more eng.

Try several real products — fidelity often holds for some patterns (solids, simple) and drifts
for others (busy veining, directional layouts). That pattern tells you where hybrid is needed.

> `inputs/` and `outputs/` are git-ignored.
