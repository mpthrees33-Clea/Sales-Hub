# Clea Sales Hub

An agentic AI sales hub for commercial construction sales reps — the showcase
instantiation of the [Clea Solutions](https://clea-solutions.ai) agentic
framework: Mission Control, Permissioned Tools, IDP→PO intake with seven
validation layers, tone-matched email drafting, and a human approval inbox at
the center. Built on the Vercel ecosystem (Next.js, AI SDK 6, Workflows,
AI Gateway).

**Status: implementation-plan phase.** The complete, execution-ready plan lives
in [`/docs`](./docs):

- [`docs/00-MASTER-PLAN.md`](./docs/00-MASTER-PLAN.md) — start here: vision, module map, dependency graph
- [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md) — stack, runtime, data model, agent harness
- [`docs/02-SECURITY-FRAMEWORK.md`](./docs/02-SECURITY-FRAMEWORK.md) — structural security invariants
- [`docs/03-DESIGN-SYSTEM.md`](./docs/03-DESIGN-SYSTEM.md) — brand, shell, approval-inbox UX
- [`docs/04-DEMO-DATA.md`](./docs/04-DEMO-DATA.md) — deterministic demo scenario & seed engine
- [`docs/work-orders/`](./docs/work-orders) — WO-01…WO-14: self-contained build specs with kickoff prompts
- [`docs/APPENDIX-recommendations.md`](./docs/APPENDIX-recommendations.md) — research-backed recommendations & roadmap

**To implement:** build `WO-01` first (everything depends on it), then run
work orders in parallel per the dependency graph in the master plan. Each WO
ends with a ready-to-paste kickoff prompt for a fresh agent session.
