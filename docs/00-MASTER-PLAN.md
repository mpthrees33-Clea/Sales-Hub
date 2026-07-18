# Clea Sales Hub — Master Implementation Plan

> **Read this first.** This document is the map. Everything else in `/docs` is a
> self-contained spec: `01`–`04` define the shared foundation every builder must
> follow; `work-orders/` contains one execution-ready work order (WO) per module.
> An implementing agent session should read `00` + `01` + its assigned WO, and
> build without needing anything else.

---

## 1. What we are building

**Clea Sales Hub** is a demo-grade, enterprise-credible **agentic AI sales hub**
for a commercial construction sales rep (architectural film / surfaces sold to
GCs, architects, designers, and distributors). It is the showcase instantiation
of the **Clea Solutions agentic framework** (clea-solutions.ai):

| Clea framework concept | How Sales Hub embodies it |
|---|---|
| **Mission Control** | The hub's dashboard IS a mission-control surface: live agent runs, approval queue, audit trail, KPIs |
| **PO Intake (IDP→PO)** | Flagship module: PO PDF → grounded extraction → **seven validation layers** → draft sales order, < 60s |
| **Email Fine-tune** | Tone-matched email drafting learned from the rep's sent mail (style-profile now, true fine-tune later) |
| **Permissioned Tools** | Every agent gets an explicit scoped tool allowlist; external effects always route through approval |
| "Grounded or it escalates" | Validation failure or missing evidence never guesses — it escalates to the human queue |
| "Every answer shows its source" | Every draft/extraction carries evidence citations (email id, PDF page, price-list row) |
| "Human handoff built in" | Nothing external ever sends without human approval; the approval inbox is the product's heart |
| "The model is 10% of the system" | One shared agent harness + policy gate + audit = the 90% we are demonstrating |

**It is a demo, deliberately.** It runs on richly seeded fictional data
("demo mode" is first-class), with real integrations (Maps, transcription,
image gen, Microsoft Graph) pluggable behind provider interfaces. The goal is a
promo video + live walkthrough proving that Clea can implement agents
*structurally and securely* through an entire sales workflow.

## 2. The story the product must tell (promo narrative)

> Rep wakes at 6:55am. Overnight, agents triaged 14 emails, drafted 6 replies
> (quotes with live stock + pricing, stock checks, sample confirmations),
> updated 3 opportunities from yesterday's emails and meetings, and processed an
> inbound PO into a validated draft sales order. The rep clears the approval
> queue in 10 minutes — work that used to take 2 hours — checks the day's
> docket and the optimized Google Maps route ("leave by 7:40"), drives to a
> meeting, records it on their phone, and walks out with a drafted follow-up
> (with the right PDS attachments) ready to approve from the truck. Wow-moments:
> a photorealistic room scene generated from a product swatch + customer lobby
> photo, and a submittal package assembled in minutes instead of 8 hours.

The full scene-by-scene script with WO mappings is in `WO-13-demo-polish.md`.
**Every WO lists the demo beats it must enable — those are its real acceptance
criteria.**

## 3. Locked decisions (do not relitigate)

1. **Vercel ecosystem throughout**: Next.js App Router, AI SDK 6 (`ToolLoopAgent`,
   `needsApproval`), Vercel Workflows (GA, `'use workflow'`), AI Gateway, Blob,
   Cron, Fluid compute. Details + versions in `01-ARCHITECTURE.md`.
2. **Email platform is Microsoft**: Outlook / Microsoft 365 via Microsoft Graph
   on Azure (Entra ID). Gmail is out. Demo mode simulates the mailbox; the
   `EmailProvider` interface must match Graph semantics so live swap is clean.
3. **Demo mode is first-class**: deterministic seeded data (fictional companies
   only), `DEMO_MODE` flag, "Simulate Overnight Run" button that invokes the
   real nightly workflow against the demo clock.
4. **One agent harness, many agents**: every agent is `defineAgent()` — no
   ad-hoc `generateText` sprawl. The harness is the framework being showcased.
5. **Draft-only, never auto-send**: all external effects terminate in approval
   objects. The deterministic policy gate lives in code, not prompts.
6. **Branding**: Clea enterprise look — minimalist, technical-documentation
   aesthetic mirroring clea-solutions.ai ("private by default" posture).
   Spec in `03-DESIGN-SYSTEM.md`.
7. **Auth**: simple demo login (one rep persona). Entra ID SSO is the documented
   production path — not built now.

## 4. Module map & dependency graph

```
                       ┌─────────────────────────────┐
                       │ WO-01 FOUNDATION            │
                       │ scaffold · schema · harness │
                       │ providers · seed · shell    │
                       └──────────────┬──────────────┘
        ┌──────────┬─────────────┬────┴────────┬──────────────┬───────────┐
        ▼          ▼             ▼             ▼              ▼           ▼
   WO-02       WO-03         WO-04         WO-06          WO-07       WO-09/10
   Dashboard   Approval      Email         PO Intake      Meetings    Samples +
   (Mission    Inbox +       Center +      (flagship)                 Catalog
   Control)    Audit UI      Triage                                      │
        │          │             │                                       ▼
        │          │             ▼                                    WO-14
        │          │          WO-05                                   Submittals
        │          │          Quote Agent
        │          │             │
        └──────────┴──────┬──────┘
                          ▼
                       WO-08 Nightly Run + Morning Brief
                          │
   WO-11 Room Scenes   WO-12 Routes/Maps   (both independent after WO-01)
                          │
                          ▼
                       WO-13 Demo Polish (last)
```

| WO | Module | Size | Depends on | Parallel track |
|----|--------|------|------------|----------------|
| 01 | Foundation: scaffold, DB schema, agent harness, providers, seed engine, demo auth, app shell | **L** | — | (serial, first) |
| 02 | Mission Control dashboard: KPIs, docket, overnight-changes feed | M | 01 | A |
| 03 | Approval inbox + policy gate + audit UI | **L** | 01 | A |
| 04 | Email center: inbox, triage agent, tone-matched drafting, asset attach | **L** | 01 | B |
| 05 | Quote agent: stock check, pricing, quote reply drafts | M | 01, 04 | B |
| 06 | **PO Intake (IDP→PO)**: PDF → extraction → 7 validation layers → draft SO | **L** | 01 | C |
| 07 | Meetings: record/upload → diarized transcript → summary → CRM updates → follow-up draft | **L** | 01 | D |
| 08 | Nightly run workflow + morning brief + Simulate Overnight | M | 01, 03, 04 | after A+B |
| 09 | Samples: catalog, sample order agent, confirmations | S | 01 | E |
| 10 | Catalog / PDS library / presentations / marketing assets | M | 01 | E |
| 11 | Room scene studio (image gen) | M | 01 | F |
| 12 | Day routes: optimized multi-stop, Maps link, leave-by | M | 01 | F |
| 13 | Demo polish: script alignment, walkthrough mode, final seed pass | M | all | (serial, last) |
| 14 | Submittal package agent | M | 01, 10 | E |

**Suggested parallelization for tomorrow:** one session builds WO-01 to
completion first (everything blocks on it — do not start others against a
half-built foundation). Then up to six parallel sessions on tracks A–F.
WO-08 starts when 03+04 land. WO-13 is the final integration pass.

## 5. How to run a work order (for the implementing agent)

1. Read `00` (this doc) + `01-ARCHITECTURE.md` + your WO. Read `02`/`03`/`04`
   when your WO tells you to.
2. Work on the branch your session designates; conventional commits
   (`feat(po-intake): …`).
3. Follow the WO's **Acceptance criteria** and **Demo beats** literally — they
   are the definition of done. Run `pnpm typecheck && pnpm lint && pnpm seed &&
   pnpm dev` and exercise the flows you built.
4. Never bypass the harness (`defineAgent`), the policy gate, or the provider
   interfaces. If a WO seems to require it, the WO is wrong — stop and flag.
5. Do not touch another WO's module directories except shared files the WO
   explicitly lists.
6. Keep seed data deterministic — fixed faker seed; `pnpm seed` must be
   idempotent.

## 6. What "enterprise-grade" means here (non-negotiables)

- **Structural security, not prompt security**: lethal-trifecta separation
  (email-reading agents hold no send-capable tools), deterministic policy gate,
  per-agent tool allowlists, recipient allowlisting, rate caps. See
  `02-SECURITY-FRAMEWORK.md` (includes OWASP LLM Top-10 2025 mapping).
- **Full observability**: every agent run/step/tool-call recorded
  (`agent_runs`/`agent_steps`), append-only `audit_log`, all visible in UI.
- **Evidence or escalation**: outputs carry citations; schema-validation failure
  escalates instead of guessing.
- **Idempotent, resumable jobs**: nightly run is a durable Workflow that
  survives redeploys; steps are retry-safe.
- **Spend safety**: model calls via AI Gateway with per-agent model choice and
  budget monitoring; image gen behind explicit user action + caps.

## 7. Deliberate scope cuts (documented, not forgotten)

- Real Microsoft Graph OAuth wiring: interface-ready, not connected (see
  `APPENDIX-recommendations.md` for the swap plan).
- True email fine-tune: style-profile few-shot now; fine-tune path documented.
- Multi-user/roles, real ERP integration, virtual-meeting bots (Recall.ai),
  mobile native app: out. The web app must be responsive (truck-usable) though.
- TTS morning-brief audio: optional stretch inside WO-08 (skip if time-boxed).
