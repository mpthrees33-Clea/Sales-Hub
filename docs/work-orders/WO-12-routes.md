# WO-12 — Day Routes: Optimized Stops, Leave-By Times, Maps Link

**Size:** M · **Depends on:** WO-01 (fills the WO-02 dashboard route slot when both merged) · **Parallel track:** F

## Objective

Turn today's meetings into an optimized driving day: geo-ordered stops, traffic-aware leg times, a "leave by" chip per stop, and a one-tap Google Maps deep link with the waypoints already in optimal order. Reps average ~21 hours/week behind the wheel — leave-by times and geo-clustering are the value; fancy cartography is not.

## Clea framework alignment

- **"Business grounding, deterministic math"** — route order and leave-by times come from the Routes API + arithmetic, not model text. No LLM in this module.
- **"Every answer shows its source"** — each leave-by chip exposes its inputs (meeting start − leg duration − buffer).
- Mission Control — the route card is a core 7am dashboard tile.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md` §6 (MapsProvider), `docs/03-DESIGN-SYSTEM.md` §5, `docs/04-DEMO-DATA.md` §1–2 (seeded Tuesday: 3 meetings with geo).
- WO-01 merged (MapsProvider interface + Demo impl, CalendarProvider, seeded meetings/accounts with lat/lng).

## Scope / Non-goals

**Scope:** Live `MapsProvider` on Google **Routes API** (`computeRoutes` — NOTE: the old Directions API is legacy; do not use it); route computation + caching per demo-day; `/routes` page; dashboard route card (fills WO-02's slot); shareable Maps deep link; leave-by calculation; lightweight map rendering (static map image or simple polyline — dependency-light).

**Non-goals:** live GPS tracking; multi-day planning; re-routing mid-day; waypoint editing beyond include/exclude toggles; embedding the full interactive Google Maps JS SDK (heavy; not needed for the demo).

## Tasks

1. **Live provider** (`src/providers/maps/live.ts`): `optimizeRoute({origin, stops: [{id, lat, lng, arriveBy?}], departAfter}) → {orderedStopIds, legs: [{fromId, toId, durationSec, distanceMeters}], totalDurationSec, shareUrl, computedAt}`.
   - `computeRoutes` with `intermediates` = stops, `optimizeWaypointOrder: true`, `routingPreference: 'TRAFFIC_AWARE'`, `departureTime`; read `optimizedIntermediateWaypointIndex` for the order; request field mask for legs duration/distance only (keeps cost at the Pro SKU, pennies at rep volume).
   - **Share URL**: build `https://www.google.com/maps/dir/?api=1&origin=<o>&destination=<d>&waypoints=<w1>|<w2>…&travelmode=driving` with waypoints ALREADY in optimized order (the link does NOT re-optimize), ≤ 9 waypoints, URL-encoded, total length < 2048 chars — truncate overflow stops from the link (never from the computed route) with a visible note.
   - Origin/destination: rep home base constant (seed: office address in the metro cluster) → last meeting (or round-trip toggle).
2. **Leave-by math** (`src/lib/routes.ts`, pure + tested): for each ordered stop, `leaveBy = meetingStart − legDuration(previous→stop) − bufferMin(default 15)`. Walk backwards from the last timed meeting so earlier leave-bys account for downstream commitments; flag conflicts (`leaveBy < previous meeting end`) as amber "tight" chips. Expose the inputs per chip for the tooltip.
3. **Demo provider** (`src/providers/maps/demo.ts`): fixture response for the seeded Tuesday (realistic durations between the 3 seeded stops in the metro cluster, plausible share URL) so everything works keyless; fixture shaped identically to live output.
4. **Caching + compute triggers.** Compute once per demo-day on first request (or during WO-08's brief assembly when merged — expose `getOrComputeTodayRoute()`), cache in a `routes_cache` table (owner-WO schema addition: id, date, payload jsonb, computed_at); manual "recompute" button. Never call the API per page render.
5. **`/routes` page** (`src/app/(hub)/routes/page.tsx`): ordered stop list (time, account, address, prep-note one-liner, leave-by chip w/ tooltip), total drive time + distance, map visual — static map image (Google Static Maps with polyline+markers) or a dependency-light inline SVG polyline over stop markers; "Open in Google Maps" primary CTA (deep link, `target=_blank`); round-trip toggle; include/exclude a stop (recompute).
6. **Dashboard route card** (fills WO-02's placeholder slot; coordinate via a `RouteCard` component export): compressed version — next stop, its leave-by countdown vs `getDemoNow()`, total day drive time, "Open in Google Maps" + link to `/routes`.
7. **Tests:** leave-by math (incl. backward-walk conflict case); share-URL builder (ordering preserved, encoding, 9-waypoint truncation, length cap); cache (second call same day → no provider hit); fixture/live output shape parity (shared Zod schema).

## Files to create or modify

- `src/providers/maps/live.ts`, `src/providers/maps/demo.ts` — create/complete
- `src/lib/routes.ts`, `src/lib/routes.test.ts` — create
- `src/db/schema.ts` — modify: `routes_cache`
- `src/app/(hub)/routes/page.tsx` — create
- `src/components/route-card.tsx` — create (consumed by WO-02 dashboard)
- `.env.example` — modify: `GOOGLE_MAPS_API_KEY`

## Agent definitions

None. This module is deliberately LLM-free — deterministic geography as a feature ("business grounding").

## Data touched

Reads: `meetings`, `accounts` (geo), `demo_state`. Writes: `routes_cache`, `audit_log` (recompute actions).

## Demo beats enabled

- Beat 4 in full: docket + optimized route + "leave by 7:40" + one tap into Google Maps.
- Beat 1: the dashboard route card is part of the 7am glance.

## Acceptance criteria

- [ ] Keyless (`DEMO_MODE`, no Maps key): `/routes` renders the seeded Tuesday — 3 stops in optimized order, leave-by chips, total drive time, working (well-formed) share link.
- [ ] With `GOOGLE_MAPS_API_KEY`: live compute returns an optimized order + traffic-aware legs; share link opens Google Maps with all stops in the computed order.
- [ ] Leave-by chips show correct arithmetic in tooltips; a deliberately tight seeded pair renders the amber "tight" state.
- [ ] Route computed at most once per demo-day per config (cache verified); recompute button works and audit-logs.
- [ ] Share URL: waypoints pre-ordered, ≤ 9, < 2048 chars, overflow handled with visible note.
- [ ] Dashboard `RouteCard` renders next-stop countdown against the demo clock.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.

## Verification

1. `pnpm seed && pnpm dev` → `/routes` keyless: verify order, chips, link URL shape (paste into a browser).
2. Set a real key locally → recompute → compare live legs; open the deep link on desktop and phone-width.
3. Toggle round-trip and exclude-a-stop → order and totals update; cache row updates once.
4. `pnpm test` (routes math + URL builder suites).

## Kickoff prompt

```
You are implementing WO-12 (Day Routes) of the Clea Sales Hub.

Read, in order: docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md,
docs/work-orders/WO-12-routes.md, then docs/03-DESIGN-SYSTEM.md §5.

Work on branch <branch>. WO-01 is merged. Use the Google Routes API
(computeRoutes with optimizeWaypointOrder + TRAFFIC_AWARE) — the legacy
Directions API is off-limits. No LLM anywhere in this module.

Definition of done: every Acceptance criteria checkbox verified via the
Verification steps; fully functional keyless via the demo provider;
pnpm typecheck && pnpm lint && pnpm test green.
```
