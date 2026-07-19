# Clea Sales Hub — Demo Script (shot-by-shot)

The filming script for the promo video. Eight beats, ~6–8 minutes. Everything
below runs against `pnpm seed` state with **no manual DB surgery** — the only
between-shot tool is the hidden **`/demo-control`** panel (auth-gated, not in
the nav). The brand promise on screen: **Mission Control**, **Permissioned
Tools**, **Grounded or it escalates**, **Every answer shows its source**,
**Human handoff built in**, and the closing line **"Drafts only — humans
send."**

## Before you roll

1. `pnpm seed` (or `/demo-control` → **Reset day**) → the app is at **Tue •
   6:55 AM**, Monday's batch unprocessed, the approval queue empty.
2. Optional: `/demo-control` → **Hide DEMO chip** for clean footage; toggle it
   back on for the transparency/determinism shots.
3. Sign in as Cole Mercer (the single seeded rep).

## Determinism guarantee

Reset day → Simulate overnight → **identical counts, every take**:
14 triaged · 3 archived · 2 sample orders · 2 sales orders (1 validated SO + 1
escalated PO) · 9 email drafts · 4 opportunity updates (incl. the Phase 3
proposal) · 1 morning brief. Locked by `pnpm test:demo`.

---

## The eight beats

| # | Screen / route | On-screen action | Suggested spoken line | Feature shown | WO | Pre-shot setup (`/demo-control`) |
|---|----------------|------------------|-----------------------|---------------|----|----------------------------------|
| **1** | `/dashboard` | Land on Mission Control at 6:55 AM. Read the overnight banner, KPI tiles vs target, morning brief narrative, today's docket + route card. | "Cole's day starts at 6:55. Overnight, the hub triaged fourteen emails and drafted six replies — all waiting for him, nothing sent." | Mission Control, morning brief, KPI tiles, overnight banner | WO-02 / WO-08 | **Reset day**, then **Simulate overnight** |
| **2** | `/approvals` | Clear the queue keyboard-first: `j`/`k` to move, open a draft, **edit then approve** (the diff highlights the change), **batch-approve** the low-tier sample confirmations. Watch the audit toast on each. | "Every draft is here for review. He edits one, approves it, batch-clears the routine ones. Ten minutes, inbox zero — and the model never touched Send." | Approval inbox, edit-with-diff, batch approve, risk tiers, audit trail | WO-03 | (queue is populated from beat 1) |
| **3** | `/po-intake` → open a PO | Open the clean PO: extraction runs, the **seven validation layers** animate green, elapsed under a minute, a draft SO appears. Then open the **escalated** PO: layer 3 shows expected-vs-found, the run stops. | "A purchase order comes in. Seven checks — pricing, terms, stock, credit — run in under a minute. When one fails, it doesn't guess. It escalates. Grounded, or it escalates." | PO extraction, 7-layer validation, draft SO, escalation | WO-06 | (POs are seeded; no setup) |
| **4** | `/routes` (and the dashboard route card) | Show today's three stops in optimized order, the **leave-by** chips (tooltip = arithmetic), total drive time, and one tap **Open in Google Maps** with the waypoints pre-ordered. Point out the amber **tight** chip. | "Three meetings today, geo-ordered. Leave by 7:40 for the first. The Raleigh afternoon is tight — the hub flags it. One tap, and the route's in Maps." | Optimized route, leave-by math, tight-conflict flag, Maps deep link | WO-02 / WO-12 | (seeded Tuesday; no setup) |
| **5** | `/meetings/[id]` — **phone width** | After the 9:30 walkthrough: record → transcript → a follow-up **draft** with Walnut Grain pricing and two PDS attachments. Approve it from the truck. | "Out of the site walk, the hub already drafted the follow-up — pricing pulled from the ERP, data sheets attached from the catalog. Cole approves it from the parking lot." | Transcript → summary → CRM → follow-up draft, mobile approve | WO-07 / WO-03 | **Jump clock → post-meeting afternoon** |
| **6** | `/scenes/new` → `/scenes/[id]` | Pick the Walnut Grain swatch + the lobby photo + "feature wall" → **Generate**. The photoreal scene appears; drag the **before/after** slider; **Attach to reply**. | "The client wants to see it. Pick the finish, pick the room — the hub renders it. Before, after. And it's now attachable to his reply." | Room-scene studio, before/after slider, attach-to-reply (capped, cost-visible) | WO-11 | (2 hero scenes seeded; live-gen this one) |
| **7** | `/submittals/new` → `/submittals/[id]` | Harborview Medical Ph2 + three products → **Assemble**. Open the package: cover sheet, table of contents, per-product dividers, all docs, page-stamped. | "The submittal package — normally eight hours of assembly. Project, products, assemble. Cover sheet, table of contents, every data sheet, page-numbered. Four minutes." | Submittal composition + deterministic PDF assembly, escalation on missing docs | WO-14 | (Harborview seeded; no setup) |
| **8** | `/approvals/audit` + an approval card | Scroll the **audit trail**. Open an approval's **scoped-tool badges**. Open the **"Why can't agents send email?"** popover. Land on the tagline. | "Every action the hub took is logged. Every agent shows the exact tools it's allowed to touch — and none of them can send. Because at Clea: **drafts only — humans send.**" | Audit trail, scoped-tool badges, why-popover, the security close | WO-02 / WO-03 (§ 02.6) | **Show DEMO chip** for the transparency shot |

---

## Between takes

`/demo-control` → **Reset day** → the app is back at Tue 6:55 AM in seconds
(the eight-week history is untouched). Re-run **Simulate overnight** and the
queue is byte-for-byte the same. This reset is itself demoable live — it *is*
the determinism proof.

## Two-takes checklist

- [ ] Take 1: Reset day → beats 1–8 in order (phone-width for beat 5).
- [ ] Reset day → Take 2: identical walk, identical queue counts.
- [ ] Jump clock lands a coherent afternoon (9:30 meeting completed, docket advanced).
- [ ] Toggle DEMO chip off/on; persists across reload; every action shows an audit row.
- [ ] Unauthenticated `/demo-control` and `/api/demo/*` are rejected.
