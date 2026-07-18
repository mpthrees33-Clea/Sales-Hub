# WO-02 — Mission Control Dashboard

**Size:** M · **Depends on:** WO-01 (merged) · **Parallel track:** A (alongside WO-03; independent of tracks B–F)

## Objective

Turn the WO-01 dashboard stub into Mission Control per 03-DESIGN-SYSTEM §5: KPI tiles computed from seeded commerce data against targets, the Overnight banner, Today's Docket, the Overnight Changes feed, a live agent-runs panel with step-level drill-in, and a real agent activity ticker. This surface is the "Rep wakes at 6:55am" opening shot and the standing proof that every agent action is observable.

## Clea framework alignment

- **Mission Control** — the dashboard *is* the mission-control surface: live runs, run traces, KPIs, route to the approval queue.
- **Full observability** — `agent_runs`/`agent_steps` rendered as a "watch the harness think" panel via `<RunTrace />` (02 §6).
- **Human handoff built in** — the Overnight banner's single CTA lands the rep in the approval queue.
- **"Every answer shows its source"** — run drill-ins show each tool call, validation, and escalation by name, duration, and outcome.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md`, `docs/03-DESIGN-SYSTEM.md` (§1–3, §5, §6), `docs/04-DEMO-DATA.md` (§1–3 for KPI shapes and expected overnight outputs).
- WO-01 merged: schema, seed, `getDemoNow()`, `CalendarProvider`, component stubs (`KpiTile`, `RunTrace`, `AgentTicker`), shell layout.

## Scope / Non-goals

**In scope:** `/dashboard` page and its panels; finishing the shared `KpiTile`, `RunTrace`, and `AgentTicker` components; the dashboard query module; a dev-only seed fixture flag so panels are demonstrable before WO-08 exists; designed empty states for every panel.

**Non-goals:** the nightly workflow and morning brief (WO-08 — this WO only *reads* their outputs); route optimization and real map thumbnails (WO-12 — placeholder only); approval inbox (WO-03); global cmd-k search (stretch, not here); no new agents; no writes to CRM/commerce tables; no audit UI (WO-03 owns it).

## Tasks

1. **Query module.** `src/lib/queries/dashboard.ts`, server-only. All time math anchored on `getDemoNow()` in rep TZ (`America/New_York`) — never `new Date()`. Shape (sketch):
   ```ts
   kpis(): Promise<{ createdWk: Kpi; createdMo: Kpi; invoicedWk: Kpi; invoicedMo: Kpi }>
   // Kpi = { valueCents: number; targetCents: number; deltaPct: number; spark: number[] } // 8 weekly points
   overnightSummary(): Promise<{ runId: string; triaged: number; drafts: number;
     approvalsPending: number; elapsedMs: number; finishedAt: Date } | null>
   todaysDocket(): Promise<DocketItem[]>       // via CalendarProvider.listEvents, never meetings table
   overnightChanges(): Promise<AccountDelta[]> // grouped per account for demo-yesterday
   recentRuns(limit: number): Promise<RunRow[]>
   runTrace(runId: string): Promise<StepRow[]> // agent_steps ordered by seq
   ```
2. **KPI tiles (top row, 4).** Per 03 §5: sales created (week, month) from `sales_orders` totals; invoiced (week, month) from `invoices.issued_at` amounts. Each tile: value (integer-cents formatted via `lib/money`), delta vs the matching `targets` row (period week/month, metric created/invoiced), and an 8-week sparkline from the seeded history.
   - Week = Mon–Sun containing demo-now, computed in rep TZ; month = calendar month of demo-now.
   - Current week must read ~85% of the $45k created target from seed — treat that as a fixture assertion in tests.
   - No chart-junk: sparkline is a single stroke inside `<KpiTile />`, no axes, no legend (03 §3).
3. **Finish `<KpiTile />`.** Implement the WO-01 stub contract: `{label, value, target, delta, spark}`; semantic color only on the delta (green ahead / amber behind); skeleton loader state; monospace value.
4. **Overnight banner.** Reads the latest nightly summary: most recent `agent_runs` where `trigger='nightly'` and `agent_name='morning-brief'`, falling back to aggregating last night's nightly-triggered runs.
   - Shows: emails triaged, drafts created, approvals pending (live count from `approvals.status='pending'`), elapsed time, finished-at in demo-clock terms.
   - One CTA button "Review approvals →" linking `/approvals`.
   - No nightly run yet → designed empty state ("No overnight run yet — agents run at 5:00 AM" with a muted "Simulate Overnight lands in WO-08" note). Never a blank card.
5. **Today's Docket.** Meetings for demo-today via `CalendarProvider.listEvents(range)` — do not query `meetings` directly; the provider seam is the point.
   - Per meeting: time (rep TZ), title, account, location, prep-notes excerpt (2 lines, expandable).
   - **Leave-by chip placeholder**: render the chip shell with an em-dash value and `title="Route timing lands in WO-12"`; WO-12 populates it via `MapsProvider`. Keep the chip's prop contract: `{leaveBy?: Date}`.
   - Seed gives 3 Tuesday meetings — order chronologically, visually mark the next upcoming one relative to demo-now.
6. **Route map preview.** Static placeholder thumbnail component (`route-preview.tsx`): stylized non-interactive map card listing the day's 3 stops in seeded order with a "Routes →" link to `/routes`. Explicit `TODO(WO-12)` marker in code; zero Maps API calls.
7. **Overnight Changes feed.** Rox-style per-account deltas for the demo-yesterday window (Monday 00:00–23:59 rep TZ relative to demo-now):
   - Source: `activities` rows with `occurred_at` in window (type icon + summary), joined with opportunity field changes where the activity detail carries old→new values (stage, value, next_step).
   - Group by account, newest first; cap at 8 accounts with a "show all" expander.
   - Render field deltas as compact `old → new` pairs; new opportunities flagged "NEW".
   - Empty state pre-nightly: "Overnight changes appear here after the agents run."
8. **Live agent-runs panel.** Table of `recentRuns(20)`: agent name, trigger, status pill (running = accent pulse, succeeded = green, escalated = amber, failed = red), model, duration, cost. Client component polling every 5s, visibility-aware (pause when tab hidden). Row click → drawer with `<RunTrace />`; deep-linkable via `/dashboard?run=<id>`.
9. **Finish `<RunTrace />`.** Timeline of `agent_steps` ordered by `seq`: LLM calls (model, tokens in/out), tool calls (name + ms), validations (pass/fail), escalations — collapsible groups, monospace ids/names, semantic colors (03 §3). Reused verbatim by WO-03/06 — do not fork it there; keep the prop contract `{steps: StepRow[]}`.
10. **Agent activity ticker made real.** `<AgentTicker />` reads the last 5 finished/running runs and renders the thin strip everywhere in the shell ("PO Intake · validated 7/7 · 41s").
    - Each item links to `/dashboard?run=<id>` (opens the run drawer).
    - Shares the 5s poll source with the runs panel (one SWR key — no duplicate polling).
    - `prefers-reduced-motion` → static list, no marquee animation.
11. **Dev fixture flag.** Extend the seed with `--with-overnight` (dev-only, WO-13 reconciles): inserts one synthetic `morning-brief` nightly run with a summary output matching 04 §3 counts, plus 4–5 finished runs with plausible ordered steps, so the banner, panel, ticker, and feed are demonstrable before WO-08. Never part of the default seed; fixture content obeys the 04 consistency rule.
12. **Quality pass.** Skeleton loaders on every async panel; all panels responsive at phone width (stacked, tiles 2-up, docket readable); dark-mode contrast checked; every panel ships a designed empty state with Clea copy (03 §5–6); no lorem ipsum.

## Files to create or modify

- `src/app/(hub)/dashboard/page.tsx` — replace stub; RSC composition of panels
- `src/app/(hub)/dashboard/_components/overnight-banner.tsx`, `docket.tsx`, `route-preview.tsx`, `changes-feed.tsx`, `runs-panel.tsx`, `run-drawer.tsx`
- `src/lib/queries/dashboard.ts` — new
- `src/components/kpi-tile.tsx`, `src/components/run-trace.tsx`, `src/components/agent-ticker.tsx` — finish WO-01 stubs (shared; keep prop contracts)
- `src/app/(hub)/layout.tsx` — mount the real ticker (shared file, explicitly listed)
- `src/db/seed/index.ts` + `src/db/seed/fixtures/overnight-runs.ts` — `--with-overnight` flag (shared file, explicitly listed)
- `tests/dashboard-queries.test.ts` — KPI window math vs seeded totals

Do not touch other modules' directories.

## Agent definitions

None. This WO builds no agents; it renders runs produced by others (and by the WO-01 smoke agent / `--with-overnight` fixtures during development).

## Data touched

Reads: `sales_orders`, `invoices`, `targets`, `meetings` (via `CalendarProvider` only), `agent_runs`, `agent_steps`, `activities`, `opportunities`, `accounts`, `approvals` (pending count), `demo_state` (via `getDemoNow()`). Writes: none outside the `--with-overnight` seed fixture.

## Demo beats enabled

- "Rep wakes at 6:55am" — the opening dashboard glance: KPIs at ~85% pace, docket for the day, demo-clock chip already live from WO-01.
- "Overnight, agents triaged 14 emails, drafted 6 replies…" — the Overnight banner states exactly this and CTAs into the queue (the entry point of the 2-hours→10-minutes montage).
- Overnight Changes feed showing the 3 opportunity updates grouped per account.
- Mission Control ambience for every other scene: ticker + live runs panel + `<RunTrace />` drill-in ("watch the harness think").
- Docket + leave-by chips set up the "leave by 7:40" beat (value filled by WO-12).

## Acceptance criteria

- [ ] Four KPI tiles show week/month created and invoiced values that match hand-computed sums of the seeded `sales_orders`/`invoices` for the demo week/month, with deltas vs `targets` and 8-point sparklines; current week reads ~85% of the $45k created target.
- [ ] Updating `demo_state.demo_now` by +7 days (SQL) shifts every KPI window accordingly — no `new Date()` anywhere in `src/lib/queries/dashboard.ts` or dashboard components (grep-verified).
- [ ] Today's Docket lists the 3 seeded Tuesday meetings chronologically with prep-note excerpts and leave-by placeholder chips, sourced via `CalendarProvider` (grep: no direct `meetings` table import in dashboard code); the next upcoming meeting is visually marked.
- [ ] Overnight banner: designed empty state on default seed; with `--with-overnight`, counts match the fixture and the "Review approvals →" CTA navigates to `/approvals`.
- [ ] Overnight Changes feed groups deltas per account for demo-yesterday with `old → new` rendering; designed empty state on default seed.
- [ ] Runs panel lists runs with correct status colors and polls every 5s (paused when tab hidden); clicking a run opens `<RunTrace />` showing every `agent_steps` row in order with kind, name, duration; escalation steps render amber; `/dashboard?run=<id>` deep link opens the drawer.
- [ ] Ticker shows the latest runs everywhere in the shell, items link to the run drawer, no duplicate polling (shared SWR key), and animation is suppressed under `prefers-reduced-motion`.
- [ ] Route preview renders the placeholder card with the day's stops and a `TODO(WO-12)` marker; zero Maps API usage.
- [ ] Every panel has a skeleton loading state and a designed empty state; the page is usable at 390px width (stacked panels, 2-up tiles).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass; `tests/dashboard-queries.test.ts` asserts the KPI window math against seeded totals.

## Verification

```bash
pnpm seed && pnpm dev                     # default seed: empty states for banner/feed/runs
pnpm smoke                                # runs panel + ticker show the smoke run; drill into its trace
pnpm seed --with-overnight && pnpm dev    # banner counts, changes feed, populated ticker
pnpm test -- dashboard                    # KPI window math vs seeded totals
pnpm typecheck && pnpm lint
```

Manual: log in → `/dashboard`; check the four tiles against `db:studio` sums for the demo week and month; run `UPDATE demo_state SET demo_now = demo_now + interval '7 days';`, refresh → all windows shift; restore with `pnpm seed --reset-day`. Click a ticker item → the correct run drawer opens; open `/dashboard?run=<id>` directly → same drawer. Verify banner CTA lands on `/approvals`. Narrow to 390px → panels stack, tiles 2-up, docket readable. Toggle OS reduced-motion → ticker static. Confirm with grep that dashboard code contains no `new Date()` and no direct `meetings` import.

## Kickoff prompt

```
You are implementing WO-02 for Clea Sales Hub. Read, in order and completely:
docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md, and docs/work-orders/WO-02-app-shell-dashboard.md
(the WO directs you into docs/03 §5 and docs/04 — read those sections too).

Work on branch {{BRANCH}} (suggested: wo-02-dashboard). Conventional commits, e.g.
feat(dashboard): …  WO-01 is merged: build on its schema, seed, getDemoNow(), providers,
and component stubs. Touch only the files WO-02 lists; keep shared component prop
contracts intact; all dashboard time math goes through getDemoNow() and the docket goes
through CalendarProvider — never the meetings table directly.

Definition of done: every checkbox in WO-02 "Acceptance criteria" is true and every
command and manual flow in "Verification" passes — KPI tiles matching seeded totals and
shifting with demo_now, docket via CalendarProvider with leave-by placeholders, banner
and feed empty states plus --with-overnight population, RunTrace drill-in with deep
links, and a real reduced-motion-aware ticker. Finish with pnpm typecheck && pnpm lint
&& pnpm test green.
```
