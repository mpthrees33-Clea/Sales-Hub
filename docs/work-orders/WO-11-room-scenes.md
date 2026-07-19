# WO-11 — Room Scene Studio (Image Generation)

**Size:** M · **Depends on:** WO-01 (soft synergy: WO-10 asset library for attach-to-reply) · **Parallel track:** F

## Objective

Build the visual wow-moment: pick a product finish, pick or upload a room photo, and generate a photorealistic scene with the finish applied to the target surfaces — reference-conditioned image editing via Gemini's image model. Scenes land in a gallery with a before/after slider and can be registered as attachable assets for email replies. Strictly user-triggered, capped, and cost-visible.

## Clea framework alignment

- **Permissioned Tools** — image generation is an explicit, user-triggered, capped tool; batch/nightly agents can never reach it.
- **"Human handoff built in"** — a scene only leaves the hub as an email attachment through the normal approval + attachment-origin path.
- **"The model is 10% of the system"** — the provider seam, caps, cost display, and asset registration are the engineering; the model call is one function.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md` §6, `docs/02-SECURITY-FRAMEWORK.md` §4 (LLM10) & §5, `docs/03-DESIGN-SYSTEM.md` §5, `docs/04-DEMO-DATA.md` §4 (pre-generated hero scenes).
- WO-01 merged (ImageGenProvider interface + Demo impl, `room_scenes` table, Blob, harness).

## Scope / Non-goals

**Scope:** `/scenes` studio + gallery; the `room-scene` agent (prompt composition only); `ImageGenProvider` Live implementation (Gemini image API); before/after slider; "Attach to reply" asset registration; per-day generation cap + estimated-cost display; demo-mode behavior (pre-generated fixtures instant, live gen behind the button).

**Non-goals:** multi-product composite scenes; video; mask-level editing UI; letting any other agent or workflow call image generation; fine-grained region selection (the prompt names target surfaces in text — "feature wall", "reception desk panels").

## Tasks

1. **Live provider** (`src/providers/imagegen/live.ts`): implement `generateScene({productSwatchUrl, roomPhotoUrl, targetSurfaces, styleNotes}) → {imageBlobUrl, model, durationMs}` against Gemini's image model (`MODELS.image` via AI Gateway if image gen is routable there, else direct `GEMINI_API_KEY` — decide at build time, keep behind the provider seam). Reference-conditioned edit: pass BOTH the product swatch and the room photo as input images with a prompt template: "Apply this architectural film finish (first reference image) to the {targetSurfaces} in this room (second reference image). Preserve the room's lighting, geometry, reflections, and all other materials. Photorealistic, no text or watermarks." Download result → `putBlob` → return blob URL. Timeouts + one retry; failures surface as a designed error state, never a spinner forever.
2. **`room-scene` agent** (`src/agents/room-scene.ts`) — thin by design, see Agent definitions: turns product data + user intent into the structured generation request; the provider call happens in the runner as a recorded step (`agent_steps` kind `tool_call`, name `generate_scene`), NOT as an agent-reachable external tool (generation is internal media creation — the *email* remains the only external effect in the system).
3. **Caps & cost** (`src/lib/scene-limits.ts`): per-demo-day cap (default 10) counted via `room_scenes` rows against `getDemoNow()`; estimated cost line ("~$0.15/image") shown pre-generation; cap-reached → disabled button + clear message. Config in module, audit row per generation.
4. **Studio UI** (`src/app/(hub)/scenes/page.tsx` + `scenes/new`): step 1 pick product (searchable swatch picker, hero `MS-WG-1147` first); step 2 pick room photo — seeded fixture rooms (lobby, conference, elevator bank) or upload (size/type-checked via `putBlob`); step 3 target surfaces (chips: feature wall, reception desk, column wraps, door panels, ceiling — multi-select) + optional style note; generate → streaming progress state → result.
5. **Gallery + before/after.** Gallery grid over `room_scenes` (product, room thumb, created). Detail: before/after slider (pointer-draggable divider, keyboard accessible), regenerate button (counts against cap), metadata (product, surfaces, duration, model).
6. **Attach to reply.** "Register as asset" action: inserts `assets` row (kind `scene`, product_ids=[product], tags auto) via WO-10's helpers if merged (else direct insert honoring the same shape + audit) — making the scene legal for the attachment-origin policy check and attachable in WO-04 drafting.
7. **Demo mode.** The two scripted hero scenes (04 §4) are seed fixtures: `room_scenes` rows + blobs exist after `pnpm seed`, so Beat 6 never waits. Demo provider `generateScene` returns a fixture variant after a believable 4–6s simulated delay when no API key is present; with a key, `DEMO_MODE` still uses live gen for THIS provider when the user explicitly clicks generate (config flag `SCENES_LIVE_IN_DEMO=true` default) — this is the one intentionally-live wow.
8. **Tests:** cap enforcement (11th generation of the demo-day rejected); prompt-composition snapshot for a known input; provider fallback (no key → fixture path); asset registration passes `isAttachable` (or shape-check if WO-10 absent).

## Files to create or modify

- `src/providers/imagegen/live.ts` — create; `src/providers/imagegen/demo.ts` — complete fixture-delay behavior
- `src/agents/room-scene.ts` — create
- `src/lib/scene-limits.ts`, `src/lib/scene-limits.test.ts` — create
- `src/app/(hub)/scenes/page.tsx`, `scenes/new/page.tsx`, `scenes/[id]/page.tsx` — create
- `src/components/before-after-slider.tsx` — create
- `.env.example` — modify: `GEMINI_API_KEY`, `SCENES_LIVE_IN_DEMO`

## Agent definitions

**`room-scene`** — model: `MODELS.frontier`.
- **Input:** `{productId, roomPhotoBlobUrl, targetSurfaces: string[], styleNote?: string}`.
- **Output schema:** `{generationRequest: {productSwatchUrl, roomPhotoUrl, targetSurfaces, styleNotes, promptText}}` — parse-or-escalate.
- **Tools:** `get_product` (read: swatch URL, finish, family, spec for prompt enrichment). No external-effect tools; no email tools.
- **maxSteps:** 3.
- **System prompt guidance:** compose a faithful generation request; describe the finish precisely from product data (e.g. "walnut wood-grain architectural film, satin finish, vertical grain"); never add brand names, text, people, or watermarks to the prompt; keep the room's identity intact.

## Data touched

Reads: `products`, `assets`, `room_scenes`, `demo_state`. Writes: `room_scenes`, `assets` (registration), `agent_runs`/`agent_steps`/`audit_log`.

## Demo beats enabled

- Beat 6 in full: swatch + lobby photo → photorealistic applied scene → before/after slider → attach to reply.
- Product-detail "generate room scene" CTA (WO-10) deep-links into the studio with product preselected.

## Acceptance criteria

- [ ] After `pnpm seed`, the gallery already shows the 2 hero scenes (no generation needed) — Beat 6 is filmable offline.
- [ ] With `GEMINI_API_KEY` set, a live generation from hero SKU + fixture lobby completes, stores to Blob, appears in gallery with before/after slider working (mouse + keyboard).
- [ ] Without a key, generate falls back to the fixture path with the simulated delay — no crash, no infinite spinner.
- [ ] The 11th generation of a demo-day is refused with a visible cap message; each generation writes an audit row; estimated cost is displayed before generating.
- [ ] "Register as asset" makes the scene attachable (passes the attachment-origin check); no nightly/batch code path can reach `generateScene` (grep: the provider is imported only by the studio runner).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.

## Verification

1. `pnpm seed && pnpm dev` → `/scenes`: hero scenes present; open before/after slider.
2. Generate live (key set): product `MS-WG-1147` + lobby fixture + "feature wall" → inspect result, gallery, audit row, `room_scenes` row.
3. Unset key locally → generate → fixture fallback behavior.
4. Loop generations to the cap → verify refusal.
5. Register a scene as asset → confirm it appears in WO-04 attachment picker (if merged) or `assets` row shape.
6. `pnpm test`.

## Kickoff prompt

```
You are implementing WO-11 (Room Scene Studio) of the Clea Sales Hub.

Read, in order: docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md,
docs/02-SECURITY-FRAMEWORK.md, docs/work-orders/WO-11-room-scenes.md.

Work on branch <branch>. WO-01 is merged. Image generation is
user-triggered only, capped, cost-visible, and reachable by no batch agent.

Definition of done: every Acceptance criteria checkbox verified via the
Verification steps; hero scenes work offline from seed fixtures; live
generation works behind the provider seam; pnpm typecheck && pnpm lint &&
pnpm test green.
```
