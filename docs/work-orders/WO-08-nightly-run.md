# WO-08 — Nightly Run, Opportunity Updates & Morning Brief

**Size:** M · **Depends on:** WO-01, WO-03, WO-04 (WO-05/06/09 agents invoked if merged; degrade gracefully if not) · **Parallel track:** after A+B

## Objective

Build the durable overnight workflow that makes the whole demo narrative true: sync yesterday's mail, triage it, fan out to specialist agents, draft opportunity updates from yesterday's emails and meetings, and assemble the morning brief — all resumable, idempotent, and invokable on demand via "Simulate Overnight" for filming. This is Mission Control's heartbeat.

## Clea framework alignment

- **Mission Control** — the nightly run is the flagship multi-agent orchestration the dashboard observes end-to-end.
- **"Human handoff built in"** — the run produces only approvals and a brief; it executes nothing external.
- **"The model is 10% of the system"** — durability, idempotency, fan-out, and observability are the demo.
- **"Every answer shows its source"** — opportunity diffs cite the emails/transcript segments that motivated them.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md` §3, `docs/02-SECURITY-FRAMEWORK.md` §5, `docs/04-DEMO-DATA.md` §2–3 (the expected-output contract).
- WO-01 (harness, providers, demo clock), WO-03 (approvals resolution exists), WO-04 (triage agent + `triage_routings`) merged.

## Scope / Non-goals

**Scope:** the `nightlyRun` Vercel Workflow; Cron trigger; `POST /api/demo/simulate-overnight`; `opportunity-update` agent; `morning-brief` agent + `morning_briefs` storage consumed by WO-02's banner; idempotency + graceful degradation when downstream WOs aren't merged; workflow↔agent_runs linkage.

**Non-goals:** TTS audio brief (OPTIONAL stretch — only if everything else is green; mark the code path clearly optional); real Graph sync; retry UI (Workflows' own retries suffice); per-account "always-on" monitoring beyond the nightly cadence.

## Tasks

1. **Workflow** (`src/app/api/workflows/nightly.ts`, Vercel Workflows `'use workflow'`):
   - `nightlyRun({trigger: 'cron' | 'simulate'})` steps (`'use step'` each, retry-safe):
     1. `syncInbox` — `EmailProvider.listNewMessages(since = lastNightlyRunAt)`; demo provider surfaces the seeded unprocessed Monday batch.
     2. `triageAll` — for each unprocessed email, invoke the `email-triage` agent (WO-04). Collect `triage_routings`.
     3. `fanOut` — for each pending routing by target: `quote` → `runQuoteFromRouting` (WO-05); `po_intake` → start the `poIntake` workflow (WO-06) with the attachment blob; `sample` → WO-09 runner; `submittal` → WO-14 runner; `reply` → WO-04 `email-reply`. **Registry-based dispatch** (`src/lib/nightly-dispatch.ts`): unmerged targets log a skipped step (`{target, reason:'module_not_installed'}`) instead of failing — the workflow must run green with only WO-01/03/04 merged.
     4. `updateOpportunities` — invoke `opportunity-update` once per account that had yesterday activity (emails, meetings with transcripts).
     5. `assembleBrief` — invoke `morning-brief`; persist row.
     6. `finalize` — update `demo_state.last_nightly_run_at`, write summary `audit()` row.
   - Record one parent `agent_runs` row (agent_name `nightly-run`, trigger) and link child runs via `workflow_run_id`; step boundaries land in `agent_steps` so `<RunTrace />` renders the whole night.
2. **Idempotency.** Keyed off `emails.is_processed` + routing claim atomicity (WO-04) + a `nightly_dedup` key on the parent run (`date(demo_now)`): re-invoking simulate-overnight on an already-processed day is a no-op that reports "nothing to process" rather than duplicating approvals. `pnpm seed --reset-day` is the reset path.
3. **Cron.** `vercel.json` cron `0 5 * * *` UTC → `GET /api/cron/nightly` → verifies Vercel cron signature/shared secret (02 §5) → starts the workflow. Route rejects unauthenticated calls.
4. **Simulate Overnight.** `POST /api/demo/simulate-overnight` (authenticated session required): starts the SAME workflow with `trigger:'simulate'` against `getDemoNow()`. Returns `{workflowRunId}`; the dashboard banner (WO-02) polls/streams progress. Button lives in WO-13's `/demo-control` and on the dashboard empty-overnight state.
5. **`opportunity-update` agent** (`src/agents/opportunity-update.ts`) — see Agent definitions. Proposals become approvals `kind:'opportunity_update'` with field-level diffs `{field, old, new, evidenceRefs}` rendered by WO-03's diff card. New-opportunity proposals (e.g. the seeded Phase 3 mention in the Harborview transcript) use `{field:'__create__', new: {name, stage:'lead', value…}}`.
6. **`morning-brief` agent** (`src/agents/morning-brief.ts`) + `morning_briefs` table (owner-WO schema addition: id, run_id, brief jsonb, created_at). Brief payload: overnight counts by category, approval-queue digest grouped by risk tier, today's docket (CalendarProvider) with prep-note one-liners, KPI snapshot (reuse WO-02's query helpers if merged; else compute inline), route placeholder slot (WO-12 fills when merged). Composition is mostly deterministic assembly; the LLM writes only the 2-3 sentence narrative summary at the top.
7. **Optional stretch — TTS brief:** `MODELS.tts` on the narrative paragraph → Blob mp3 → player chip on the banner. Skip unless all acceptance criteria are green.
8. **Tests:** dispatch registry (unmerged target → skip, merged → invoke stub); dedup (second simulate same day → no new approvals); expected-count assertion test running the full workflow against a fresh seed with all trackable modules mocked/merged (see Acceptance).

## Files to create or modify

- `src/app/api/workflows/nightly.ts` — create
- `src/app/api/cron/nightly/route.ts` — create
- `src/app/api/demo/simulate-overnight/route.ts` — create
- `src/lib/nightly-dispatch.ts` — create (registry; degrades gracefully)
- `src/agents/opportunity-update.ts`, `src/agents/morning-brief.ts` — create
- `src/db/schema.ts` — modify: `morning_briefs`, parent-run dedup key
- `vercel.json` — modify: cron entry
- `src/lib/nightly.test.ts` — create

## Agent definitions

**`opportunity-update`** — model: `MODELS.frontier`.
- **Input:** `{accountId, sinceIso}`; runner loads yesterday's emails (untrusted-wrapped), transcript segments (untrusted-wrapped), current opportunities/activities for that account.
- **Output schema:** `{updates: [{opportunityId | null, diffs: [{field, old, new}], rationale, evidence: [{type, ref, quote}]}], noChange: boolean}` — parse-or-escalate.
- **Tools:** `get_account_context` (read: opportunities, recent activities, open quotes) · `propose_opportunity_update` (external → approval per update). No email/send tools.
- **System prompt guidance:** propose only changes directly supported by quoted evidence from yesterday's emails/transcripts (stage moves, value changes, next steps, new opportunity mentions); one approval per opportunity; when evidence is ambiguous, prefer `noChange` — a wrong CRM write costs trust.

**`morning-brief`** — model: `MODELS.fast`.
- **Input:** assembled deterministic payload (counts, digest, docket, KPIs).
- **Output schema:** `{narrative: string}` (≤ 3 sentences). Tools: none. The runner merges narrative + payload into `morning_briefs`.

## Data touched

Reads: `emails`, `email_threads`, `triage_routings`, `transcripts`, `meetings`, `opportunities`, `activities`, `quotes`, `approvals`, `targets`, `sales_orders`, `invoices`, `demo_state`. Writes: `morning_briefs`, `demo_state.last_nightly_run_at`, `approvals` (via harness), `agent_runs`/`agent_steps`/`audit_log`.

## Demo beats enabled

- Beat 1 (the whole wake-up scene): overnight banner counts, brief, KPI snapshot.
- Beat 2 feeds from the approvals this run created.
- The live "Simulate Overnight" is also the in-person sales demo trick (run the night in front of a prospect).

## Acceptance criteria

- [ ] On a fresh `pnpm seed`, `POST /api/demo/simulate-overnight` (with WO-04/05/06/09 merged) yields exactly the 04-DEMO-DATA §3 counts: 14 triaged (3 archived), ~2 quote drafts, 2 stock-check replies, 2 sample confirmations (low tier), 1 scheduling reply, 1 technical reply, 1 validated draft SO, 1 escalated PO, 3 opportunity_update approvals (incl. one `__create__` for Phase 3), 1 morning brief. Structural counts asserted in a test; LLM text free.
- [ ] Second simulate on the same demo day → zero new approvals, "nothing to process" summary.
- [ ] With ONLY WO-01/03/04 merged, the workflow completes green; skipped targets visible as skipped steps in the run trace.
- [ ] Cron route rejects unsigned/unauthenticated invocation; simulate route requires a session.
- [ ] Parent run + child runs linked via `workflow_run_id`; `<RunTrace />` on the parent shows every step incl. skips.
- [ ] Killing/redeploying mid-run and resuming does not duplicate approvals (durability + idempotency together).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.

## Verification

1. Fresh seed → simulate via dashboard button (or curl with session cookie) → watch banner progress → verify approval queue contents against the count contract.
2. `pnpm db:studio`: inspect parent/child `agent_runs`, `morning_briefs` row, `triage_routings` consumed states.
3. Re-run simulate → confirm no-op behavior.
4. Unauthenticated curl to both routes → 401.
5. `pnpm test`.

## Kickoff prompt

```
You are implementing WO-08 (Nightly Run + Morning Brief) of the Clea Sales Hub.

Read, in order: docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md,
docs/work-orders/WO-08-nightly-run.md, then docs/04-DEMO-DATA.md §2–3
(the expected-output contract your acceptance tests assert). Consume the
routing contract from docs/work-orders/WO-04-email-center.md — do not
reimplement it.

Work on branch <branch>. WO-01, WO-03, WO-04 are merged; other specialist
modules may or may not be — your dispatch registry must degrade gracefully.

Definition of done: every Acceptance criteria checkbox verified via the
Verification steps; the workflow is durable (Vercel Workflows), idempotent
per demo-day, and produces the exact structural counts from 04-DEMO-DATA §3
on a fresh seed with all modules merged.
```
