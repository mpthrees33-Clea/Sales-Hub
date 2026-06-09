# 01 — Product

Two features, **one platform**, sharing one core asset: a fresh, structured index of commercial
finishes.

## Feature A — Alternate Finder ("or-equal" engine)

**Input:** a specified product the designer can't use. They provide whatever they have — a cut
sheet / brochure (PDF or photo), a product name, or just color + size + finish — plus
constraints: **budget** and **required lead time** (e.g. "in stock / ≤ 4 weeks").

**Output:** 3–5 ranked, **verified-available** alternates, each with:
- The match broken down by attribute: color (ΔE + LRV), pattern/movement, finish, nominal size,
  performance (PEI / abrasion, DCOF / slip, fire/IIC where relevant), application.
- *Why it matches and where it falls short* ("same LRV and size, matte vs. honed, 3-week lead,
  8% over budget").
- A **source link** proving it's real and current (no hallucinated SKUs).
- Optional **creative** picks: a non-obvious cross-material substitute (e.g. porcelain that
  reads as the discontinued honed limestone, in stock, rated for the floor traffic the stone
  wasn't).

## Feature B — Visualizer

**Input:** a product image (the original or a chosen alternate) + the target surface (a space
photo *or* an elevation/drawing).

**Output:** a faithful, photorealistic render of *that specific product* applied to the surface
— correct color, grout, pattern, scale, perspective, lighting — that the designer can drop into
a presentation. Fast enough to do live.

## The combined loop (the real product)

```
Specified product
   │  discontinued / long lead / over budget
   ▼
Alternate Finder ──► verified, in-budget, in-lead-time candidates (with "why")
   │  designer picks one
   ▼
Visualizer ──► render the alternate into the actual project / elevation
   │
   ▼
Confirm the look → spec with confidence (export board / submittal)
```

## Primary users & jobs-to-be-done

- **Interior designer / architect (A&D):** "My spec died — get me an approved or-equal I can
  show the client today, and let me see it in the space."
- **Manufacturer/distributor rep (incl. the founder):** "Win the spec live in the meeting; keep
  my products in the running when the original choice falls through."
- **Specifier / project manager:** "Substitution request with documentation, fast."

## Explicitly out of scope (for now)

- Retail homeowner self-serve visualizer (that's Roomvo's turf — don't).
- Full takeoff/estimating, ordering/checkout, BIM integration. Later, maybe.

## What makes it trustworthy (non-negotiables)

- **Never show an alternate it can't verify is real and currently available** (cite the source).
- **Explainable** matches (numbers designers recognize: ΔE, LRV, lead time), not a black box.
- **Faithful** renders — the actual product, never a "reimagined" look-alike.
