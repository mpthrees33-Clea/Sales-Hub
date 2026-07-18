# WO-01 — Foundation: Scaffold, Schema, Harness, Providers, Seed, Auth, Shell

**Size:** L · **Depends on:** — (nothing; everything depends on this) · **Parallel track:** serial, first — no other WO starts until this merges

## Objective

Build the entire shared foundation of Clea Sales Hub: Next.js scaffold, the full Drizzle/Neon data model, the agent harness every module runs on, the demo provider layer, the deterministic seed engine, demo-login auth, and the app-shell skeleton. This WO is the framework being showcased — the harness, policy gate, and audit spine are the product. When it merges, a fresh clone must `pnpm install && pnpm db:push && pnpm seed && pnpm dev` into a seeded, authenticated shell whose harness provably intercepts external effects.

## Clea framework alignment

- **"The model is 10% of the system"** — this WO is the other 90%: one harness, one policy gate, one audit path, shared by every agent.
- **Permissioned Tools** — `scopedTool()` effect taxonomy and per-agent allowlists are born here.
- **Human handoff built in / "Drafts only — humans send"** — external-effect interception → `approvals` rows is implemented here, once, for all agents.
- **"Grounded or it escalates"** — `EscalationError` + parse-or-escalate output handling.
- **"Every answer shows its source"** — evidence accumulation on runs and approvals.
- **Mission Control** — `agent_runs`/`agent_steps` recording makes every run observable.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md`, `docs/02-SECURITY-FRAMEWORK.md`, `docs/03-DESIGN-SYSTEM.md`, `docs/04-DEMO-DATA.md` — all five, fully. This WO implements the mechanisms those docs mandate.
- No WOs precede this one.

## Scope / Non-goals

**In scope:** scaffold + tooling; complete DB schema (every table in 01 §4); Vercel Blob wiring; `env.ts`; demo auth + middleware; the full harness (01 §5); policy-gate module (02 §2.3); all six provider interfaces + Demo implementations (01 §6); seed engine + fixtures + consistency check (04); app-shell skeleton + shared component stubs (03 §2–3); `audit()`, `getDemoNow()`, `lib/ai/models.ts`; pnpm scripts; a smoke agent proving the harness end to end.

**Non-goals:** no module features (dashboard content, approval inbox UX, email center, PO pipeline, workflows, cron). No live providers (Graph, AssemblyAI, Maps, Gemini) — interfaces only. No Entra ID. Stub pages render titles + designed empty states, nothing more. Do not build the approval-resolution server action (WO-03) — only the rows agents create.

## Tasks

1. **Scaffold.** `pnpm dlx create-next-app` (latest stable, App Router, TypeScript strict, Tailwind, ESLint, `src/` dir). Add `strict: true`, `noUncheckedIndexedAccess: true` to tsconfig. Install shadcn/ui (init with CSS variables), AI SDK 6 (`ai`), AI Elements via its shadcn registry, `zod`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `@vercel/blob`, `@faker-js/faker`, `pdf-lib`, `vitest`, `tsx`. Geist Sans + Geist Mono via `geist` package. Dark mode default (`<html class="dark">`), light mode functional. Define the palette once in `globals.css` per 03 §1: near-black/near-white neutrals, one accent, semantic green/amber/red.
2. **Repo layout.** Create the exact tree from 01 §2: `src/app/(auth)/login`, `src/app/(hub)/{dashboard,approvals,email,po-intake,meetings,samples,catalog,scenes,routes,submittals,settings}`, `src/app/api/{agents/[agent],workflows,cron/nightly,demo}`, `src/agents/`, `src/harness/`, `src/providers/{email,calendar,transcription,maps,imagegen,erp}`, `src/db/{schema.ts,client.ts,seed/}`, `src/lib/`, `src/components/`.
3. **Env.** `src/lib/env.ts`: Zod-parsed, fail-fast at import. Required: `DATABASE_URL`, `AI_GATEWAY_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `DEMO_MODE` (boolean, default `true`), `SESSION_SECRET` (min 32 chars), `DEMO_LOGIN_PASSWORD`. Optional: `ASSEMBLYAI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, `MS_GRAPH_*` (documented, unused). Maintain `.env.example` with every var + one-line comment. Never `NEXT_PUBLIC_` for secrets.
4. **Schema — every table from 01 §4** in `src/db/schema.ts`. Conventions: uuid `id` pk, `created_at`/`updated_at` timestamptz, snake_case, pg enums for all enumerated columns, money as integer cents. Tables (30):
   - CRM: `accounts`, `contacts`, `projects`, `opportunities`, `activities`
   - Email: `email_threads`, `emails`
   - Meetings: `meetings`, `transcripts`
   - Product/ERP: `products`, `pds_documents`, `inventory`, `price_lists`, `price_list_items`, `account_price_lists`
   - Commerce: `quotes`, `purchase_orders`, `sales_orders`, `invoices`, `sample_orders`, `submittal_packages`
   - Assets: `assets`, `presentations`, `room_scenes`
   - Agent infrastructure: `agent_runs`, `agent_steps`, `approvals`, `audit_log`, `demo_state`
   - KPI: `targets`
   Columns and enums exactly as 01 §4 specifies (e.g. `opportunities.stage`, `email_threads.triage`, `approvals.kind/risk_tier/status`, `agent_runs.status`, `purchase_orders.validation` jsonb). Add indexes on hot paths: `emails(thread_id, received_at)`, `approvals(status, risk_tier)`, `agent_steps(run_id, seq)`, `activities(occurred_at)`, `audit_log(created_at)`. `src/db/client.ts` exports the Drizzle client over Neon serverless. Wire `drizzle-kit` config; `pnpm db:push`, `pnpm db:studio`.
5. **Blob wiring.** `src/lib/blob.ts`: `putBlob(path, data, {contentType, maxBytes})` and `getBlobUrl` wrappers over `@vercel/blob`; enforce size/type checks before write (02 §5). All fixture uploads and future module uploads go through this.
6. **Demo auth.** Rep persona constant `src/lib/rep.ts` (fixed uuid, "Cole Mercer", `cole.mercer@meridian-surfaces.example.com`, TZ `America/New_York`) — the seed and `approvals.approver_user_id` use this id; there is no users table. `/login` page (Clea-styled, single password field) → server action checks `DEMO_LOGIN_PASSWORD`, sets `clea_session` cookie: HMAC-SHA256-signed payload `{sub, iat, exp}` using `SESSION_SECRET`, `httpOnly`, `secure`, `sameSite=lax`, 7-day expiry. `src/middleware.ts` verifies signature + expiry for all `(hub)` routes, `/api/agents/*`, and `/api/demo/*`; unauthenticated → redirect `/login` (JSON 401 for API). Export `requireSession()` helper for server actions/handlers.
7. **Clock + audit.** `src/lib/demo-clock.ts`: `getDemoNow()` reads `demo_state.demo_now` (singleton row; per-request cache); domain logic never calls `new Date()`. `src/lib/audit.ts`: `audit({actor, action, objectType, objectId, detail})` — the single insert path into `audit_log`; no update/delete function for that table exists anywhere in app code. Store refs, never full bodies, in `detail`.
8. **Models.** `src/lib/ai/models.ts`: central Gateway model ids — `MODELS.fast` (Claude Haiku tier, e.g. `anthropic/claude-haiku-4.5`), `MODELS.frontier` = `anthropic/claude-sonnet-4.5`, `MODELS.pdf` (Sonnet, native PDF input), `MODELS.image` (`google/gemini-3-pro-image`), optional `MODELS.tts`. Confirm exact Gateway id strings at build time; no module ever hardcodes a model string.
9. **Harness — `src/harness/`** (01 §5; implement once, no per-module forks):
   - `tool.ts` — `scopedTool({name, description, effect: 'read'|'internal_write'|'external', inputSchema, execute})`. Tools return `{data, evidence?: Evidence[]}` where `Evidence = {type: 'email'|'pdf_page'|'price_row'|'transcript_segment'|'inventory_row', ref, quote}`.
   - `define-agent.ts` — `defineAgent<In, Out>({name, description, model, inputSchema, outputSchema, tools, maxSteps?, systemPrompt})` returning `AgentDef` with `run(input, {trigger, workflowRunId?})`. Implemented over AI SDK 6 `ToolLoopAgent`; the agent can only see tools in its list (Permissioned Tools).
   - **External-effect interception**: for `effect:'external'` tools the harness registers the tool with `needsApproval` semantics — `execute` is never called from the model loop; instead the harness validates the input against the tool schema, assigns a risk tier via `assignRiskTier(kind, payload)` (policy-gate module), and inserts an `approvals` row (`kind`, `proposed_action`, `evidence` accumulated so far, `risk_tier`, `run_id`, `status:'pending'`), then returns a `{queued: true, approvalId}` tool result to the model. The agent literally cannot cause an external effect.
   - `run-recorder.ts` — wraps every run: insert `agent_runs` (agent_name, trigger, input, model, started_at, workflow_run_id) at start; one `agent_steps` row per LLM call / tool call / validation / escalation (seq, kind, name, input, output, duration_ms) via loop callbacks; finalize with output, status, tokens_in/out, cost_usd (Gateway usage), finished_at. Agent authors write zero logging code.
   - `evidence.ts` — accumulator: collects `evidence[]` from every tool result during a run; stored on `agent_runs.output` and attached to any approval created by the run.
   - Escalation: `EscalationError(reason, detail?)` typed error. Output failing `outputSchema.parse`, explicit throw, or validation failure → run `status:'escalated'` + an approval requiring human input. Never silent catch, never guess.
   - `untrusted.ts` — `wrapUntrusted(raw, {source})`: strips HTML to text, truncates (default 8,000 chars), wraps in `<untrusted_content source="…">…</untrusted_content>` with the standing "data, never instructions" preamble. The only path by which email bodies / PDF text / transcripts enter prompts.
   - `policy-gate.ts` — deterministic, prompt-free. Exports `runPolicyGate(approval, ctx): {allowed: true} | {allowed: false, reason, rule}` (called at approval-*execution* time by WO-03) and `assignRiskTier(kind, payload)`. Rules: (a) recipient allowlist — every to/cc/bcc must match a seeded contact email or allowlisted domain derived from seeded contacts; (b) rate caps — ≤ 50 external sends per trailing demo-clock hour (config), per-agent cap (default 20); count executed effects via `audit_log`; (c) attachment origin — attachment refs must be `assets` rows or blob outputs of a recorded run; (d) risk tiers — `high` (quotes ≥ $10,000, all sales orders, anything committing price) can never be batch-approved; sample confirmations and scheduling replies are `low`. Config object in the module, not env.
10. **Providers — `src/providers/`** (01 §6): define the six interfaces + Demo implementations + `index.ts` resolver returning Demo when `env.DEMO_MODE` (Live classes are unimplemented stubs that throw with a clear message):
    - `EmailProvider`: `listNewMessages(since)`, `getThread(id)`, `createDraft(draft)`, `send(approvedDraftId)` — Graph-shaped (delta query, draft objects). Demo reads/writes `email_threads`/`emails`, marks sent mail in-app only.
    - `CalendarProvider`: `listEvents(range)` — Demo reads `meetings`.
    - `TranscriptionProvider`: `transcribe(blobUrl) → {segments: [{speaker, t0, t1, text}]}` — Demo returns the seeded transcript fixture.
    - `MapsProvider`: `optimizeRoute(stops, departOrArriveBy) → {order, legs, leaveBy, shareUrl}` — Demo returns cached fixtures for the seeded day.
    - `ImageGenProvider`: `generateScene({productSwatchUrl, roomPhotoUrl, prompt})` — Demo returns pre-generated fixture scenes.
    - `ErpProvider`: stock/pricing/order queries — always seeded Postgres.
11. **Seed engine — `src/db/seed/`** (04, all of it): `pnpm seed` runs `tsx src/db/seed/index.ts`. Fixed faker seed; idempotent truncate+reinsert; blob fixtures uploaded once and reused via a checksum manifest. Build the full scenario: 40 accounts (12 GC / 10 arch-design / 8 distributor / 10 owner-other) across Charlotte/Raleigh/Greensboro with geo + 1–3 contacts each on `.example.com`-style domains; ~60 SKUs across families with spec, swatch placeholder, inventory, 3 price tiers, hero SKU `MS-WG-1147 "Walnut Grain"`; per-SKU PDS + install + test report + warranty PDFs **generated with pdf-lib** (real-looking templated content); ~25 opportunities incl. `specified_bod`; 8 weeks of `sales_orders` + `invoices` shaped to targets ($45k/wk created, $40k/wk invoiced, current week ~85% pace); `targets` rows week+month; the staged Monday batch — 14 unprocessed inbound emails per 04 §2 categories (hand-written bodies referencing real seeded SKUs/people/projects; quote `Q-1042` seeded), **2 PO PDFs generated with pdf-lib** (one clean, one with the deliberate layer-3 unit-price mismatch); ~30 sent-mail corpus in Cole's voice; Monday's 2 meetings (one with pre-baked diarized transcript JSON + audio fixture); Tuesday's 3 meetings with geo + prep notes; `demo_state.demo_now` = Tuesday 6:55 AM `America/New_York`. Flags: `--reset-day` returns `demo_state` to Tue 6:55 AM, resets `is_processed` on the staged emails, and deletes agent_runs/agent_steps/approvals created after the seed baseline — CRM/commerce history untouched (film-day reset).
12. **Consistency check.** Seed-time pass that scans every fixture (email bodies, transcript, PO PDFs' line data) for referenced SKUs, contact emails, project names, prices, and quote numbers and asserts each exists in the DB — exit non-zero with a named list of misses. Runs automatically at the end of every seed.
13. **App shell skeleton** (03 §2): `(hub)/layout.tsx` — left rail with all 11 routes (icons + labels, Approvals shows a count badge stub, collapsible at phone width); top bar with demo-clock chip ("DEMO • Tue 6:55 AM" from `getDemoNow()`, rep avatar); `<AgentTicker />` stub strip. Each route gets a stub page: module title + designed empty state with Clea copy (no lorem ipsum, 03 §5).
14. **Shared component stubs** in `src/components/` with final prop contracts (03 §3), minimal rendering: `EvidenceChips`, `AgentBadge`, `RiskTierTag`, `RunTrace`, `KpiTile`, `ApprovalCard` (shell), `DraftEditor` (shell), `PdfViewer` (shell). WO-02/03 flesh them out; contracts do not change after this WO.
15. **Smoke agent + scripts.** `src/agents/smoke.ts` (see Agent definitions) + `scripts/smoke.ts` runner (`pnpm smoke`). Wire `package.json` scripts: `dev`, `build`, `typecheck` (`tsc --noEmit`), `lint`, `seed` (passes through flags), `db:push`, `db:studio`, `test` (vitest), `smoke`. Unit tests: policy gate (all four rule families), untrusted wrapper, harness interception, seed consistency check failure path.

## Files to create or modify

Everything is new. Key paths (01 §2 layout):

- `package.json`, `tsconfig.json`, `drizzle.config.ts`, `.env.example`, `vitest.config.ts`
- `src/app/globals.css`, `src/app/layout.tsx`, `src/middleware.ts`
- `src/app/(auth)/login/page.tsx` (+ action)
- `src/app/(hub)/layout.tsx` and stub `page.tsx` under `dashboard/ approvals/ email/ po-intake/ meetings/ samples/ catalog/ scenes/ routes/ submittals/ settings/`
- `src/app/api/agents/[agent]/route.ts` (thin dispatcher stub over the harness)
- `src/harness/define-agent.ts`, `src/harness/tool.ts`, `src/harness/policy-gate.ts`, `src/harness/evidence.ts`, `src/harness/run-recorder.ts`, `src/harness/untrusted.ts`, `src/harness/errors.ts`
- `src/providers/{email,calendar,transcription,maps,imagegen,erp}/` (interface + demo impl each), `src/providers/index.ts`
- `src/db/schema.ts`, `src/db/client.ts`, `src/db/seed/index.ts`, `src/db/seed/fixtures/**` (email bodies, transcript JSON, PDF generators, audio, swatches, scene images), `src/db/seed/consistency.ts`
- `src/lib/env.ts`, `src/lib/rep.ts`, `src/lib/demo-clock.ts`, `src/lib/audit.ts`, `src/lib/blob.ts`, `src/lib/ai/models.ts`, `src/lib/{format,dates,money}.ts`
- `src/components/{evidence-chips,agent-badge,risk-tier-tag,run-trace,kpi-tile,approval-card,draft-editor,pdf-viewer,agent-ticker}.tsx`
- `src/agents/smoke.ts`, `scripts/smoke.ts`, `tests/**`

## Agent definitions

**`smoke`** — proves the harness; deleted or repurposed by WO-13.
- Model tier: `MODELS.fast` (Haiku).
- Tools: `readDemoState` (`effect:'read'` — returns `demo_now`, evidence `[{type:'inventory_row'…}]` optional), `sendTestEmail` (`effect:'external'` — schema `{to: string[], subject: string, body: string}`; never executes, harness intercepts → `approvals` row kind `email_draft`).
- Input schema: `{ note: string }`. Output schema: `{ ok: boolean, demoNow: string }`.
- System prompt guidance: "You are a harness self-test. Call `readDemoState`, then call `sendTestEmail` addressed to the seeded contact provided in input, then return `{ok: true, demoNow}`. Do not retry the send tool after it reports queued."

## Data touched

All 30 tables are created; the seed writes every table except `agent_runs`, `agent_steps`, `approvals` (written only by the smoke agent at runtime) — `audit_log` receives seed/reset events via `audit()`. `demo_state` singleton owned here.

## Demo beats enabled

- The opening shot's "DEMO • Tue 6:55 AM" demo-clock chip and dark Clea shell.
- The entire deterministic world every later beat depends on: 14-email overnight batch, Q-1042, the two PO PDFs (happy path + layer-3 escalation), Walnut Grain hero SKU, Tuesday's three-stop route day, Cole's voice corpus.
- The structural "Drafts only — humans send" guarantee under every filmed approval.
- Raw material for the "watch the harness think" panel (`agent_runs`/`agent_steps`).

## Acceptance criteria

- [ ] `pnpm install && pnpm typecheck && pnpm lint && pnpm test` all pass on a fresh clone; TS strict, no `any` in exported APIs.
- [ ] `pnpm db:push` creates all 30 tables with the enums, jsonb shapes, and indexes of 01 §4.
- [ ] `pnpm seed` produces the 04-DEMO-DATA scenario counts: 40 accounts (12/10/8/10 mix), ~60 SKUs each with 4 generated doc PDFs + inventory + 3 price tiers, hero SKU `MS-WG-1147`, ~25 opportunities, 8 weeks of orders/invoices at the specified pace, `targets` rows, 14 unprocessed inbound emails matching the 04 §2 category map (incl. 2 pdf-lib-generated PO PDFs, one with the layer-3 price mismatch), ~30 sent-mail corpus, 2 Monday meetings (one with diarized transcript fixture), 3 Tuesday meetings with geo + prep notes, `demo_state.demo_now` = Tue 6:55 AM ET.
- [ ] Running `pnpm seed` twice yields identical row counts and ids (fixed faker seed, idempotent); blob fixtures are not re-uploaded on the second run.
- [ ] The consistency check fails loudly (non-zero exit, named misses) when a fixture references a non-seeded SKU — proven by a unit test.
- [ ] `pnpm seed --reset-day` restores Tue 6:55 AM and clears post-baseline runs/approvals without touching CRM/commerce history.
- [ ] `pnpm smoke`: the smoke agent defined via `defineAgent` runs, records one `agent_runs` row with ordered `agent_steps` (LLM + tool calls, durations, tokens, cost), and its external-effect tool call lands as a **pending `approvals` row instead of executing** — no email state changes.
- [ ] Policy-gate unit tests pass: a non-allowlisted recipient is blocked with a named rule; rate cap blocks the 51st send in a demo-clock hour; a non-library attachment ref is blocked; `high` tier refuses batch context.
- [ ] `wrapUntrusted` strips HTML, truncates, and wraps with markers — unit-tested; it is the only ingress for untrusted text.
- [ ] Login with `DEMO_LOGIN_PASSWORD` sets a signed `httpOnly` cookie; every `(hub)` route and `/api/agents|demo/*` redirects/401s without it; tampered cookies rejected.
- [ ] Shell renders dark by default with all 11 rail routes, demo-clock chip reading `getDemoNow()`, ticker stub; all stub pages show designed Clea empty states; rail collapses at phone width.
- [ ] `audit_log` has exactly one write path (`audit()`) and zero update/delete paths — verified by grep in review.
- [ ] `.env.example` lists every env var consumed by `src/lib/env.ts`.

## Verification

```bash
pnpm install && pnpm typecheck && pnpm lint && pnpm test
pnpm db:push && pnpm seed && pnpm seed          # second run proves idempotence — compare counts
pnpm seed --reset-day
pnpm smoke                                       # prints run id; inspect agent_runs/agent_steps/approvals
pnpm db:studio                                   # eyeball scenario counts vs 04 §1–2
pnpm dev
```

Manual: visit `/dashboard` logged out → redirected to `/login`; log in → shell with rail, clock chip "DEMO • Tue 6:55 AM"; click every rail item → stub + empty state; narrow to 390px → rail collapses. After `pnpm smoke`, confirm in `db:studio`: one run, ordered steps, one pending `email_draft` approval with evidence, zero sent emails, audit rows for run + approval creation.

## Kickoff prompt

```
You are implementing WO-01 for Clea Sales Hub. Read, in order and completely:
docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md, and docs/work-orders/WO-01-foundation.md
(WO-01 will direct you into docs/02, 03, and 04 — read those too; this WO implements them).

Work on branch {{BRANCH}} (suggested: wo-01-foundation). Conventional commits, e.g.
feat(foundation): …

Build exactly what WO-01 specifies: scaffold, full 30-table schema, agent harness with
external-effect interception, policy gate, providers, deterministic seed engine with
generated PDF fixtures and consistency check, demo auth, app shell skeleton, shared
component stubs, and the smoke agent. Never bypass the harness or provider seams; if the
WO conflicts with docs/01, stop and flag it.

Definition of done: every checkbox in WO-01 "Acceptance criteria" is true and every
command in "Verification" passes, including: pnpm seed producing the 04-DEMO-DATA counts
idempotently, pnpm smoke recording a run with steps whose external tool call becomes a
pending approval (never executes), and the policy-gate unit test blocking a
non-allowlisted recipient. Finish with pnpm typecheck && pnpm lint && pnpm test green.
```
