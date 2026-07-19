# 01 — Architecture Specification

> The technical spine. Every WO builds on this. If a WO conflicts with this
> document, this document wins; flag the conflict rather than improvising.

---

## 1. Stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (latest stable), App Router, TypeScript strict** | RSC + route handlers; deployed on Vercel |
| AI runtime | **AI SDK 6** (`ai` package) | `ToolLoopAgent`, per-tool `needsApproval`, Zod tool schemas, streaming |
| Model access | **Vercel AI Gateway** | one API key, model strings like `anthropic/claude-sonnet-4.5`, spend monitoring, fallbacks |
| Durable jobs | **Vercel Workflows / WDK** (`'use workflow'` / `'use step'`) | nightly run, PO pipeline, transcription pipeline |
| Scheduling | **Vercel Cron** → kicks nightly workflow | demo also triggers same workflow via button |
| DB | **Neon Postgres** + **Drizzle ORM** | schema in `src/db/schema.ts`; migrations via drizzle-kit |
| Files | **Vercel Blob** | PO PDFs, PDS PDFs, audio, swatches, generated scenes |
| UI | **Tailwind CSS + shadcn/ui + Vercel AI Elements** | see `03-DESIGN-SYSTEM.md` |
| Validation | **Zod everywhere** | agent I/O schemas, API payloads, env parsing |
| Auth | Demo login (single rep persona, signed session cookie) | Entra ID documented as prod path, not built |
| Package mgr | **pnpm** | scripts: `dev`, `build`, `typecheck`, `lint`, `seed`, `db:push`, `db:studio` |

**Model routing (via AI Gateway):**

| Job | Model | Why |
|---|---|---|
| Triage/classification | Claude Haiku (fast tier) | cheap, high-volume, metadata-first |
| Drafting, extraction, summarization, agents generally | Claude Sonnet (frontier tier) | quality where it shows on camera |
| PO extraction (PDF) | Claude Sonnet with native PDF input | page-grounded citations |
| Room scenes | Gemini 3 Pro Image | reference-conditioned photoreal interiors |
| (optional) brief TTS | OpenAI gpt-4o-mini-tts | stretch goal only |

Centralize model ids in `src/lib/ai/models.ts` — never hardcode in modules.

## 2. Repository layout

```
src/
  app/
    (auth)/login/
    (hub)/                      # authenticated shell
      dashboard/                # WO-02 Mission Control
      approvals/                # WO-03
      email/                    # WO-04 (+05 quote surfaces inside email views)
      po-intake/                # WO-06
      meetings/                 # WO-07
      samples/                  # WO-09
      catalog/                  # WO-10 (products, PDS, presentations, assets)
      scenes/                   # WO-11
      routes/                   # WO-12
      submittals/               # WO-14
      settings/
    api/
      agents/[agent]/route.ts   # interactive agent invocations (streaming)
      workflows/                # workflow entrypoints (nightly, po-intake, transcribe)
      cron/nightly/route.ts
      demo/                     # simulate-overnight, reset-demo
  agents/                       # ONE FILE PER AGENT — defineAgent() instances
    email-triage.ts  quote.ts  po-intake.ts  meeting-followup.ts
    opportunity-update.ts  morning-brief.ts  sample-order.ts
    room-scene.ts  submittal.ts
  harness/                      # WO-01: THE framework (do not fork per-module)
    define-agent.ts  tool.ts  policy-gate.ts  evidence.ts  run-recorder.ts
  providers/                    # WO-01: demo↔live seams
    email/    calendar/  transcription/  maps/  imagegen/  erp/
    index.ts                    # resolves Demo vs Live from env
  db/
    schema.ts  client.ts  seed/
  lib/                          # shared utils (ai/models.ts, format, dates, money)
  components/                   # shared UI (03-DESIGN-SYSTEM.md)
docs/                           # this pack
```

## 3. Runtime topology

- **Interactive agents** (quote-on-demand, meeting follow-up, room scene,
  re-triage): `POST /api/agents/[agent]` route handlers, streaming via AI SDK,
  running on Fluid compute. Request → harness run → draft/approval object →
  stream progress to UI.
- **Nightly run**: Vercel Cron (e.g. `0 5 * * *` UTC) → durable Workflow
  `nightlyRun()`:
  1. `syncInbox` (provider pull of "yesterday's" mail)
  2. `triageEmails` — Email Triage agent classifies each (metadata-first)
  3. fan-out per category → Quote / PO Intake / Sample / general-reply agents
  4. `updateOpportunities` — Opportunity agent over yesterday's emails+meetings
  5. `assembleMorningBrief` — brief + KPIs + docket + route precompute
  Each step is `'use step'` (retry-safe, resumable). **Simulate Overnight**
  (`POST /api/demo/simulate-overnight`) invokes the *same workflow* with the
  demo clock — this is what gets filmed.
- **PO Intake pipeline**: workflow `poIntake(blobUrl)`: extract (Claude PDF) →
  seven validation layers (each a named step, results recorded) → draft SO →
  approval object. Layers: 1 schema-valid, 2 SKU match, 3 price-list match,
  4 qty/UOM sanity, 5 customer/ship-to match, 6 credit/terms, 7 duplicate-PO
  detection. Deterministic code does the checking; the model only extracts.
- **Transcription pipeline**: upload audio → Blob → workflow: transcribe
  (provider) → diarized transcript → Meeting agent (summary, CRM deltas,
  follow-up draft) → approval objects.
- **Approvals** end every pipeline. Approving/rejecting/editing is an app
  mutation (server action), audit-logged, and *not reachable by any agent tool*.

## 4. Data model (Drizzle, Postgres)

Conventions: `id` uuid pk, `createdAt`/`updatedAt` timestamptz, snake_case
columns, enums as pg enums. Owner WO may add columns; core shape below is shared.

**CRM core** — `accounts` (name, type: gc|architect|designer|distributor|owner,
address, geo lat/lng, tier), `contacts` (account_id, name, email, phone, role),
`projects` (account_id, name, segment: office_ti|hospitality|healthcare|…,
stage, address, geo), `opportunities` (project_id, account_id, name, stage:
lead|qualified|specified_bod|quoted|po_received|closed_won|closed_lost, value,
probability, expected_close, next_step, last_activity_at), `activities`
(polymorphic log: type email|meeting|call|note|sample|quote|po, refs, summary,
occurred_at).

**Email** — `email_threads` (subject, participants[], last_message_at, triage:
quote_request|stock_check|po|sample_request|submittal_request|scheduling|
general|noise, triage_confidence, status), `emails` (thread_id, direction,
from/to/cc, subject, body_text, body_html_sanitized, received_at, attachments
jsonb→Blob refs, is_processed).

**Meetings** — `meetings` (title, account_id, project_id, starts_at, ends_at,
location, geo, prep_notes, status), `transcripts` (meeting_id, audio_blob_url,
segments jsonb [{speaker, t0, t1, text}], summary, action_items jsonb).

**Product/ERP** — `products` (sku, name, family: wood|metal|stone|solid|texture,
finish, description, swatch_blob_url, unit, spec jsonb), `pds_documents`
(product_id, kind: pds|install|test_report|warranty, blob_url, pages),
`inventory` (product_id, on_hand, allocated, lead_time_days, restock_at),
`price_lists` (name, tier) + `price_list_items` (price_list_id, product_id,
unit_price, min_qty), `account_price_lists` (account_id → price_list_id).

**Commerce** — `quotes` (account_id, opportunity_id, number, status:
draft|pending_approval|sent|accepted|expired, lines jsonb [{product_id, qty,
unit_price, source_row_id}], totals, valid_until), `purchase_orders`
(blob_url, extracted jsonb, validation jsonb [{layer, pass, detail}], status:
received|extracted|validated|escalated|converted, customer_po_number),
`sales_orders` (po_id, account_id, number, lines jsonb, totals, status),
`invoices` (sales_order_id, number, amount, issued_at, paid_at),
`sample_orders` (account_id, contact_id, items jsonb [{product_id, size, qty}],
ship_to, status: draft|pending_approval|ordered|shipped|delivered),
`submittal_packages` (project_id, name, product_ids[], sections jsonb, status,
output_blob_url).

**Assets** — `assets` (kind: brochure|case_study|presentation|scene|swatch,
title, blob_url, tags[], product_ids[]), `presentations` (title, slides jsonb,
status), `room_scenes` (product_id, source_photo_blob_url, output_blob_url,
prompt, status).

**Agent infrastructure (the showcase — get these right)**
- `agent_runs`: agent_name, trigger (nightly|user|workflow), input jsonb,
  output jsonb, status: running|succeeded|escalated|failed, model, tokens_in/out,
  cost_usd, started_at, finished_at, workflow_run_id.
- `agent_steps`: run_id, seq, kind: llm_call|tool_call|validation|escalation,
  name, input jsonb, output jsonb, duration_ms.
- `approvals`: run_id, kind: email_draft|quote|sales_order|sample_order|
  opportunity_update|submittal|scene_send, risk_tier: low|standard|high,
  proposed_action jsonb (typed per kind), evidence jsonb
  [{type: email|pdf_page|price_row|transcript_segment|inventory_row, ref, quote}],
  status: pending|approved|edited_approved|rejected|expired,
  approver_user_id, edits jsonb (diff), resolved_at.
- `audit_log` (append-only; no update/delete paths in app code): actor
  (agent:<name>|user:<id>|system), action, object_type/object_id, detail jsonb,
  created_at. Write via a single `audit()` helper.
- `demo_state`: singleton — demo_now (simulated clock), last_nightly_run_at,
  scenario_version.

**KPIs** are computed from `sales_orders`(created) and `invoices`(invoiced) by
week/month vs `targets` (period, metric, value).

## 5. The agent harness (`src/harness/`) — the product being showcased

```ts
// define-agent.ts (shape, not final code)
export function defineAgent<In, Out>(cfg: {
  name: string;                        // 'po-intake', 'email-triage', …
  description: string;
  model: ModelId;                      // from lib/ai/models.ts
  inputSchema: z.ZodType<In>;
  outputSchema: z.ZodType<Out>;        // parse-or-escalate, never guess
  tools: ScopedTool[];                 // EXPLICIT allowlist — Permissioned Tools
  maxSteps?: number;
  systemPrompt: (ctx: RunCtx) => string;
}): AgentDef<In, Out>

// tool.ts
export function scopedTool(cfg: {
  name: string;
  description: string;
  effect: 'read' | 'internal_write' | 'external';  // ← the key bit
  inputSchema: z.ZodType<any>;
  execute: (input, ctx) => Promise<unknown>;
})
```

Harness behavior (implemented once in WO-01, used by all):
1. **Permissioned Tools**: agent can only call tools in its list. Tools with
   `effect:'external'` are wrapped by the harness: instead of executing, they
   **create an `approvals` row** (AI SDK 6 `needsApproval` pattern) — the agent
   literally cannot cause an external effect.
2. **Policy gate** (`policy-gate.ts`, deterministic code, runs at approval
   *execution* time, not draft time): recipient domain/address allowlist
   (seeded contacts only), per-hour send cap, attachment origin check (must be
   library assets or run outputs), risk-tier rules. Model output never bypasses.
3. **Run recording**: every run → `agent_runs`; every LLM/tool call →
   `agent_steps`; costs from Gateway usage. Wrapper handles this — agent
   authors write zero logging code.
4. **Evidence**: tools return `{data, evidence[]}`; harness accumulates and
   stores on the run + approval. UI renders evidence chips ("every answer shows
   its source").
5. **Escalation**: output failing `outputSchema`, low confidence, or any
   validation-layer failure → `status: escalated` + approval of kind requiring
   human input ("grounded or it escalates").
6. **Untrusted content isolation**: email bodies/PDF text enter prompts inside
   `<untrusted_content>` delimiters via a single helper; triage runs
   metadata-first; email-reading agents' tool lists contain **no external-effect
   tools** (lethal-trifecta separation) — they end at drafts/approvals.

## 6. Provider pattern (`src/providers/`)

Interface-first; `DEMO_MODE=true` resolves Demo implementations.

- `EmailProvider`: `listNewMessages(since)`, `getThread(id)`,
  `createDraft(draft)`, `send(approvedDraftId)` — semantics mirror MS Graph
  (delta query, draft objects) so `GraphEmailProvider` is a drop-in later.
  Demo impl reads/writes seeded tables and marks "sent" mail in-app only.
- `CalendarProvider`: `listEvents(range)` — Graph-shaped; Demo reads `meetings`.
- `TranscriptionProvider`: `transcribe(blobUrl) → {segments[]}` — Live:
  AssemblyAI (diarization on); Demo: returns pre-baked transcript fixture.
- `MapsProvider`: `optimizeRoute(stops[], depart|arriveBy) → {order, legs,
  leaveBy, shareUrl}` — Live: Google Routes API (`optimizeWaypointOrder`,
  TRAFFIC_AWARE) then build `google.com/maps/dir/?api=1&…` link with waypoints
  pre-ordered (≤9 waypoints; link does not re-optimize). Demo: cached fixture
  responses for the seeded day.
- `ImageGenProvider`: `generateScene({productSwatchUrl, roomPhotoUrl, prompt})`
  — Live: Gemini 3 Pro Image; Demo: pre-generated fixtures for the two scripted
  scenes + live gen behind a button.
- `ErpProvider`: stock/pricing/order queries — always the seeded Postgres
  (there is no live ERP; a cosmetic "Sync ERP" affordance is fine).

## 7. Environment & config

`src/lib/env.ts` — Zod-parsed. Core: `DATABASE_URL`, `AI_GATEWAY_API_KEY`,
`BLOB_READ_WRITE_TOKEN`, `DEMO_MODE`, `SESSION_SECRET`, `DEMO_LOGIN_PASSWORD`;
optional live keys: `ASSEMBLYAI_API_KEY`, `GOOGLE_MAPS_API_KEY`,
`GEMINI_API_KEY` (or via Gateway), `MS_GRAPH_*` (documented, unused in demo).
Never `NEXT_PUBLIC_` for secrets; mark all keys **Sensitive** in Vercel.
`.env.example` maintained in WO-01 and updated by every WO that adds a var.

## 8. Conventions

- TypeScript strict; no `any` in exported APIs. Server components by default;
  client components only where interactive. Server actions for mutations;
  route handlers for streaming/webhooks/workflows.
- Money as integer cents; dates UTC in DB, rep's TZ (America/New_York) in UI.
- All demo "now" reads via `getDemoNow()` (respects `demo_state.demo_now`) —
  never `new Date()` in domain logic, or Simulate Overnight breaks.
- Seeds: fixed faker seed; `pnpm seed` idempotent (truncate+reinsert, keeps
  blob fixtures); scenario spec in `04-DEMO-DATA.md`.
- Errors: agents throw typed `EscalationError` → harness converts to escalated
  runs; never silent catch.
