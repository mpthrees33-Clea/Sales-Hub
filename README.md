# Clea Sales Hub

An agentic AI sales hub for commercial construction sales reps — the showcase
instantiation of the [Clea Solutions](https://clea-solutions.ai) agentic
framework: Mission Control, Permissioned Tools, IDP→PO intake with seven
validation layers, tone-matched email drafting, and a human approval inbox at
the center. Built on the Vercel ecosystem (Next.js, AI SDK, Blob, Cron).

**Status: built.** All fourteen work orders (WO-01…WO-14) are implemented,
tested, and demo-ready. The plan pack that specified them lives in
[`/docs`](./docs); the shot-by-shot filming script is
[`docs/DEMO-SCRIPT.md`](./docs/DEMO-SCRIPT.md).

## Quickstart

```bash
# PostgreSQL 16 on localhost:5432 (postgres/postgres), then:
cp .env.example .env          # set DATABASE_URL, SESSION_SECRET, DEMO_LOGIN_PASSWORD
pnpm install
pnpm db:push                  # drizzle schema → database
pnpm seed                     # deterministic demo world (idempotent)
pnpm dev                      # log in with DEMO_LOGIN_PASSWORD
```

Fully functional **keyless**: with `AI_GATEWAY_API_KEY` empty, every agent runs
its deterministic `demoScript` through the same tool wrappers, policy gate, run
recording, and approval interception as the live model path (model id
`clea/demo-deterministic`). Set the key to swap in live models via the AI
Gateway — no code changes.

## Film-day controls

- `pnpm seed --reset-day` (or `/demo-control` → Reset day) — back to Tue
  6:55 AM: Monday batch unprocessed, queue empty, 8-week history intact.
- `/demo-control` (hidden, session-gated, audit-logged) — reset day, simulate
  overnight, jump clock to the post-meeting afternoon, toggle the DEMO chip.
- `pnpm test` — full suite. `pnpm test:demo` — the two-takes proof: reset →
  simulate must produce the exact docs/04 §3 queue, twice in a row.

## Environment adaptations (vs the plan's Vercel-native assumptions)

The plan targets the Vercel platform end to end; this build keeps every seam
but substitutes local-friendly implementations behind the same interfaces:

- **Database** — node-postgres (`pg`) against local PostgreSQL; the Neon
  serverless driver is selected automatically when `DATABASE_URL` points at
  `neon.tech`.
- **Blob storage** — a local content store under `var/blob/` served by
  `/api/blob/[...key]`; swaps to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is
  set. Fixture uploads are idempotent across reseeds.
- **Workflows** — the PO-intake, transcription, and nightly pipelines are
  in-repo idempotent step functions shaped like Vercel Workflows (each step
  recorded as a `workflow_step` on the parent run), so a move to
  `'use workflow'` is mechanical.
- **Cron** — `vercel.json` schedules `/api/cron/nightly` (5 AM) for deploys;
  locally the nightly is driven by Simulate Overnight.
- **AI SDK** — `generateText` tool-loop on AI SDK 5 with gateway model strings;
  the plan's AI SDK 6 `ToolLoopAgent`/`needsApproval` semantics are enforced in
  the harness (`defineAgent` + execution-time approval interception) instead.

## Docs

- [`docs/00-MASTER-PLAN.md`](./docs/00-MASTER-PLAN.md) — vision, module map, dependency graph
- [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md) — stack, runtime, data model, agent harness
- [`docs/02-SECURITY-FRAMEWORK.md`](./docs/02-SECURITY-FRAMEWORK.md) — structural security invariants
- [`docs/03-DESIGN-SYSTEM.md`](./docs/03-DESIGN-SYSTEM.md) — brand, shell, approval-inbox UX
- [`docs/04-DEMO-DATA.md`](./docs/04-DEMO-DATA.md) — deterministic demo scenario & seed engine
- [`docs/work-orders/`](./docs/work-orders) — WO-01…WO-14 build specs
- [`docs/DEMO-SCRIPT.md`](./docs/DEMO-SCRIPT.md) — the 8-beat filming script
- [`docs/APPENDIX-recommendations.md`](./docs/APPENDIX-recommendations.md) — research-backed recommendations & roadmap
