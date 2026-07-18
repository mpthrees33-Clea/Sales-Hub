# WO-13 — Demo Polish: Script Alignment, Film-Day Hardening, Final Pass

**Size:** M · **Depends on:** all (WO-01–WO-12, WO-14 merged) · **Parallel track:** (serial, last)

## Objective

Turn a finished product into a filmable one. Walk the entire promo script end-to-end against the seeded data, fix every rough edge, harden the film-day reset/simulate controls behind a hidden authenticated panel, and deliver `docs/DEMO-SCRIPT.md` — a shot-by-shot filming script covering all 8 beats including the security close. Done means the full script runs start-to-finish **twice in a row** with no manual DB surgery.

## Clea framework alignment

- The video is the deliverable this whole pack exists for: it must *show* "Mission Control", "Permissioned Tools", "Grounded or it escalates", "Every answer shows its source", "Human handoff built in", and "Drafts only — humans send" — verbatim on screen, per 03 §1.
- The **security close** beat films the structural story (02 §6): audit trail, scoped-tool badges, the "Why can't agents send email?" popover — differentiation, not garnish.
- Determinism is the brand: reset → simulate → identical counts, every take.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md` (§2 narrative), `docs/01-ARCHITECTURE.md`, `docs/02-SECURITY-FRAMEWORK.md` (§6), `docs/03-DESIGN-SYSTEM.md` (all), `docs/04-DEMO-DATA.md` (§2–§4), and **every** other WO's "Demo beats enabled" section — those beats are this WO's checklist.
- **All other WOs merged.** Do not start WO-13 against a partial build; if a beat's owning module is missing, stop and flag.

## Scope / Non-goals

**In scope:** polish-level fixes anywhere in the repo (copy, spacing, latency, empty states, mobile layouts, streaming/skeleton states, dark-mode contrast); seed/fixture adjustments; the hidden `/demo-control` panel + supporting demo API routes; `docs/DEMO-SCRIPT.md`; performance pass on dashboard + approvals; final consistency sweep.

**Non-goals:** new features, new agents, schema redesigns, behavioral rewrites of other WOs' modules (a fix that changes module behavior beyond polish → file it back to the owning WO and flag), live-provider integration work, load testing beyond the two demo-critical surfaces.

## Tasks

1. **(a) Full script execution.** Run the complete promo script from 00 §2 against fresh seed: reset day → Simulate Overnight → clear the queue → PO intake (both POs) → docket + route → meeting record/follow-up → room scene → submittal → security close. Log every rough edge into a working punch list (scratch file, not committed), categorized:
   - **Copy** — awkward/robotic strings, inconsistent capitalization, off-canon vocabulary;
   - **Spacing/layout** — misalignment, cramped cards, truncation, orphaned labels;
   - **Latency** — any visible wait lacking a streaming or skeleton state;
   - **Empty states** — undesigned or default-framework empties;
   - **Mobile** — broken or awkward phone-width layouts on Approvals/Email/Meetings.
   Fix each; repeat the walk until a clean run.
2. **(a) Beat audit per WO.** For each of WO-02…WO-12 + WO-14, re-verify its "Demo beats enabled" list on the seeded day. Any failing beat is a release blocker: fix at polish level or flag the owning module.
3. **(b) Pre-generate heavy artifacts into seed.** Nothing slow or non-deterministic may generate on camera unless the beat *is* live generation: the 2 room scenes, the diarized Harborview transcript, PO page-image derivatives (if WO-06 caches any), PDS PDFs, static route-map thumbs — all present as seed fixtures/blobs after `pnpm seed`. Verify Demo providers serve fixtures instantly.
4. **(b) One-command reset.** Verify `pnpm seed --reset-day` restores exact Tue-6:55-AM state in a single command — demo clock, unprocessed Monday batch, empty approval queue, no leftover runs/approvals/POs/transcripts from prior takes — without touching the 8-week history. Fix the seed engine if any residue survives.
5. **(b) Overnight-count assertion.** Run Simulate Overnight on fresh seed and assert the **exact** 04 §3 outputs: 14 triaged (3 noise archived) · 2 quote drafts · 2 stock-check replies · 2 sample confirmations (low tier, batch-approvable) · 1 scheduling reply · 1 technical reply · 1 validated draft SO (7/7) · 1 escalated PO (layer 3) · 3 opportunity updates (incl. Phase 3 proposal) · 1 morning brief. Encode as an automated test (`pnpm test:demo` or equivalent) that fails on count drift.
6. **(b) Hidden `/demo-control` panel.** Authenticated route (session required per 02 §5; not in the nav rail; noindex). Actions, each audit-logged with confirmation:
   - **Reset day** — server-side equivalent of `pnpm seed --reset-day`.
   - **Simulate overnight** — invokes the real nightly workflow (existing `/api/demo/simulate-overnight`), with live step progress.
   - **Jump clock: post-meeting afternoon** — sets `demo_state.demo_now` to Tue ~4:15 PM with the 9:30 meeting completed and its transcript/follow-up artifacts staged, so beat 5 films without waiting.
   - **Toggle DEMO chip** — hide/show the "DEMO • Tue 6:55 AM" top-bar chip for filming takes (persisted in `demo_state`).
7. **(c) `docs/DEMO-SCRIPT.md`.** Shot-by-shot filming script as a table per shot: **screen/route · on-screen action · suggested spoken line · feature being shown · owning WO · pre-shot setup (which demo-control action)**. Cover the 8 beats:
   1. Cold open — Tue 6:55 AM, Mission Control: morning brief, overnight banner "14 emails triaged, 6 drafts ready", KPI tiles (WO-02/08).
   2. Approval queue — keyboard-first clear in ~10 min: j/k, edit-then-approve with diff, batch-approve low tier, audit toasts (WO-03).
   3. PO Intake flagship — clean PO: extraction, seven layers animate, elapsed < 60s, draft SO; then the escalated PO: layer-3 expected-vs-found, "Grounded or it escalates" (WO-06).
   4. Docket + route — today's 3 meetings, optimized stops, "leave by 7:40", Maps link (WO-02/12).
   5. Meeting — phone-width: record, transcript, follow-up draft with Walnut Grain pricing + 2 PDS attachments, approved from the truck (WO-07/03).
   6. Room scene — swatch + lobby photo → photoreal scene, before/after slider, attach to reply (WO-11).
   7. Submittal — Harborview Medical Ph2 package assembled in minutes (WO-14).
   8. **Security close** — audit trail scroll, an approval card's scoped-tool badges, the "Why can't agents send email?" popover, closing line **"Drafts only — humans send"** (WO-02/03, 02 §6).
8. **(d) Performance pass.** Dashboard + approvals: snappy LCP on cold load (target < 2.0s on a Vercel preview, throttled Fast-3G-free baseline) — RSC data fetching, no client-waterfall on first paint, skeletons where unavoidable; verify a streaming/progress state exists **everywhere an agent runs live** (interactive agent calls, workflow-backed runs, Simulate Overnight) — no dead spinners, no frozen UI on camera.
9. **(e) Consistency sweep.** Repo-wide: zero lorem/placeholder text (`grep -ri "lorem\|TODO copy\|placeholder" src` clean, minus legitimate input placeholders); no default/placeholder icons; Clea vocabulary strings verbatim per 03 §1 (grep for near-miss variants like "Human-in-the-loop" and fix to canon); ids/SKUs/run-ids in monospace; dark-mode contrast pass on every surface (primary demo mode); `prefers-reduced-motion` respected on the new animations; empty states designed on every list.
10. **The two-takes proof.** Execute the entire DEMO-SCRIPT.md top to bottom **twice consecutively**, using only `/demo-control` between takes. Any step requiring psql/db-studio/manual editing is a failing acceptance criterion — fix and repeat.

## Files to create or modify

- `docs/DEMO-SCRIPT.md` — new: the shot-by-shot filming script (deliverable c).
- `src/app/(hub)/demo-control/page.tsx` — new: hidden panel + co-located `actions.ts` (server actions).
- `src/app/api/demo/jump-clock/route.ts` — new: post-meeting-afternoon state (authenticated).
- `src/app/api/demo/reset-day/route.ts` — new or verify existing from WO-01 (`seed --reset-day` equivalent).
- `src/db/seed/*` — modify: pre-generated artifacts, reset-day completeness, count fixes.
- `src/db/schema.ts` — modify only if `demo_state` needs the chip-visibility flag; additive.
- `tests/demo-counts.test.ts` (or repo-convention path) — new: 04 §3 count assertions post-simulate.
- **Any module file, polish-level only** (copy, spacing, empty states, skeletons, contrast, mobile) — keep diffs surgical; conventional commits scoped to the touched module (`fix(approvals): …`).

## Agent definitions

None. This WO adds no agents and must not modify any agent definition, tool allowlist, or the harness. If a beat fails inside an agent, flag the owning WO.

## Data touched

- **Writes:** `demo_state` (demo_now, chip visibility, last_nightly_run_at), seed-owned tables via reset/simulate (through the seed engine and the real nightly workflow only — no bespoke mutation paths), `audit_log` (every demo-control action).
- **Reads:** everything — the script traverses all modules.
- **Blob:** upload pre-generated fixtures (scenes, transcript audio, PDFs, map thumbs) at seed time; reuse across reseeds per 04 §4.
- **Invariant:** demo-control actions require an authenticated session and go through `audit()`; reset-day never touches the 8-week history.

## Demo beats enabled

This WO enables **the film itself** — all 8 beats above, plus:
1. Between-takes reset: presenter opens `/demo-control`, clicks Reset day, and the app is back at Tue 6:55 AM in seconds — also demoable live to prove determinism.
2. Simulate Overnight on stage produces the exact expected queue, every time.
3. The DEMO chip disappears for final footage and returns for transparency shots.

## Acceptance criteria

- [ ] **The full DEMO-SCRIPT.md runs start-to-finish twice in a row** on one deployment, using only `/demo-control` between takes — zero manual DB surgery, zero failed beats.
- [ ] `pnpm seed --reset-day` restores exact Tue-6:55-AM state in one command: demo clock reset, Monday batch unprocessed, approvals/runs/POs/transcripts from prior takes gone, 8-week history intact.
- [ ] The automated count test passes: Simulate Overnight on fresh seed yields exactly the 04 §3 counts (structure deterministic; LLM prose may vary).
- [ ] `/demo-control` exists, requires auth, is absent from the nav, and its four actions (reset day, simulate overnight, jump clock to post-meeting afternoon, toggle DEMO chip) work and are audit-logged.
- [ ] Jump-clock lands in a coherent post-meeting state: demo_now Tue afternoon, 9:30 meeting completed with transcript + follow-up approval staged, docket/route reflecting the time.
- [ ] `docs/DEMO-SCRIPT.md` covers all 8 beats shot-by-shot (screen, action, spoken-line suggestion, feature, owning WO, pre-shot setup), including the security close with audit trail, scoped-tool badges, and "Drafts only — humans send".
- [ ] Dashboard and approvals LCP meet the target on cold load of a production build; every live agent execution surface shows a streaming/progress state.
- [ ] Consistency sweep clean: no lorem/placeholder copy or icons anywhere; Clea vocabulary verbatim per 03 §1; dark-mode contrast passes on all surfaces; `prefers-reduced-motion` honored; every list has a designed empty state.
- [ ] Every WO's "Demo beats enabled" list re-verified green on the seeded day; punch list empty or explicitly flagged to owning WOs.
- [ ] `pnpm typecheck && pnpm lint && pnpm seed` clean; no agent/harness/policy-gate code modified by this WO.

## Verification

```bash
pnpm typecheck && pnpm lint
pnpm seed && pnpm seed --reset-day          # idempotent + one-command reset
pnpm test:demo                              # 04 §3 count assertions after simulate
pnpm build && pnpm start                    # production build for the LCP check
grep -ri "lorem" src && echo FAIL || echo OK
```

Manual flows:
1. Take 1: `/demo-control` → Reset day → walk DEMO-SCRIPT.md beats 1–8 in order, phone-width for beat 5.
2. `/demo-control` → Reset day → Take 2: identical walk; confirm identical queue counts and states.
3. Jump clock → confirm afternoon state (meeting done, follow-up approval present, docket advanced).
4. Toggle DEMO chip off/on; confirm persistence across reload and audit rows for all four actions.
5. Unauthenticated request to `/demo-control` and `/api/demo/*` → rejected.
6. Lighthouse (or Vercel Speed Insights) on `/dashboard` and `/approvals` cold: LCP within target; watch every agent surface once for streaming states.

## Kickoff prompt

```text
You are implementing WO-13 (Demo Polish) for Clea Sales Hub — the final,
serial pass after all other WOs are merged.

Read, in order: docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md, and
docs/work-orders/WO-13-demo-polish.md (this WO). Then read docs/02 §6,
docs/03 in full, docs/04 §2–§4, and the "Demo beats enabled" section of every
other work order — those beats are your checklist.

Work on branch <branch: chore/wo-13-demo-polish>. Conventional commits scoped
to whatever module each polish fix touches. Polish-level diffs only: no new
features, no agent/harness/policy-gate changes — flag behavioral problems back
to the owning WO instead of rewriting.

Definition of done: the acceptance criteria all pass, docs/DEMO-SCRIPT.md
exists covering all 8 beats including the security close, and you have
personally executed the full script start-to-finish TWICE in a row using only
/demo-control between takes — no manual DB surgery. pnpm typecheck && pnpm
lint && pnpm seed clean, count test green, LCP targets met. If it isn't
filmable twice, it isn't done.
```
