# WO-05 — Quote Agent: Stock Check, Pricing, Quote Reply Drafts

**Size:** M · **Depends on:** WO-01, WO-04 · **Parallel track:** B (stacks on WO-04; WO-08 invokes this agent during the nightly run)

## Objective

Turn inbound quote requests into review-ready quote replies with live stock, lead times, and account-tier pricing — fast enough to make "first responder wins" a filmable claim. The agent proposes; deterministic code prices; the human approves. Also powers stock-check replies with the same read tools.

## Clea framework alignment

- **"Business grounding, deterministic math"** — the model never computes a price; a pure pricing function does, from price-list rows.
- **"Grounded or it escalates"** — an unresolved SKU or missing price-list row escalates with candidates; it never guesses.
- **"Every answer shows its source"** — every quote line carries evidence: source email, inventory row, price-list row.
- **Permissioned Tools** — read-only ERP tools + one external-effect draft tool; nothing sendable.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md`, `docs/02-SECURITY-FRAMEWORK.md` §2–3, `docs/04-DEMO-DATA.md` §2–3.
- WO-01 merged (harness, ErpProvider, schema). WO-04 merged (`triage_routings` + `claimRouting` in `src/lib/routing.ts`, `email-reply` conventions, style profile).

## Scope / Non-goals

**Scope:** `quote` agent; deterministic pricing module; quote persistence (`quotes` rows); quote-reply email drafts as approvals; stock-check reply enrichment for WO-04's `email-reply` (shared ERP read tools); "drafted N minutes after receipt" latency surfacing; split-shipment proposal for the seeded partial-stock case; a minimal `/email`-adjacent quote review surface inside the approval card (WO-03 renders it; this WO supplies the typed payload).

**Non-goals:** PDF quote rendering (formatted text/table email body is fine); margin/discount approval chains; multi-currency; quote revisioning; converting accepted quotes to orders (PO Intake owns order creation).

## Tasks

1. **Pricing module** (`src/lib/pricing.ts`) — pure, tested, no LLM anywhere:
   - `resolvePriceList(accountId)` → account's price list via `account_price_lists` (fallback: `list` tier).
   - `priceLines(accountId, lines: [{productId, qty, uom}])` → per-line `{unitPriceCents, minQty, priceListItemId}` + totals (subtotal, per-line extended, integer cents). Missing price row → throw `EscalationError('price_row_missing', {productId})`.
   - Unit tests: tier selection, min-qty enforcement, missing-row escalation, rounding.
2. **ERP read tools** (`src/agents/tools/erp.ts`, shared with WO-04's stock-check replies) via `scopedTool`, all `effect:'read'`, all returning evidence:
   - `lookup_products({queries: string[]})` → fuzzy SKU/name resolution: exact SKU → normalized SKU (strip spaces/dashes, case) → name trigram; returns per-query `{resolved?: productId, candidates: [{productId, sku, name, score}]}`. Never auto-picks below the confidence threshold — returns candidates instead.
   - `check_stock({productIds})` → `{onHand, allocated, available, leadTimeDays, restockAt}` per product; evidence type `inventory_row`.
   - `get_pricing({accountId, lines})` → wraps `priceLines`; evidence type `price_row` with price-list row refs.
3. **`quote` agent** (`src/agents/quote.ts`) via `defineAgent` — see Agent definitions.
4. **Quote persistence.** On successful run: insert `quotes` row (`status:'pending_approval'`, `number` = `Q-<seq>` continuing the seeded sequence, lines jsonb with `source_row_id` per line, `valid_until` = demo-now + 30d) and one approval `kind:'email_draft'` whose `proposed_action` embeds the reply draft (formatted quote table in the body, style-profile applied via WO-04's drafting conventions) plus `quoteId` linkage. Risk tier via `assignRiskTier` (≥ $10,000 → `high`).
5. **Routing consumption.** Entry point `runQuoteFromRouting(routingId)`: `claimRouting` (atomic) → load source email (body via `wrapUntrusted`) → agent run → mark routing `consumed` with `consumed_by_run_id`. Called by WO-08's nightly fan-out and by a manual "Draft quote" button on quote-request threads in the email UI.
6. **Partial stock / split shipment.** When `check_stock` shows available < requested for a line, the agent proposes a split (ship available now, backorder remainder with lead time) in the reply body and flags it in the payload (`splitProposed: true`). The seeded scenario (04 §2 line 1) exercises this.
7. **Latency surfacing.** Store `draftedAt` − source email `received_at` (demo clock) on the quote payload; WO-03's approval card and the email thread view render "drafted 4m after receipt". Add to the quote approval card payload contract.
8. **Stock-check enrichment.** Export the ERP tool set for WO-04's `email-reply` agent (stock-check category) so those replies quote live availability/lead times with `inventory_row` evidence. One tool module, two consumers — no duplication.
9. **Tests:** pricing unit tests (task 1); SKU resolution table (exact/normalized/fuzzy/none); agent-level: seeded quote-request email → run produces one `quotes` row + one pending approval with ≥ 3 evidence items and zero external executions; unresolved-SKU email → `escalated` run, no `quotes` row.

## Files to create or modify

- `src/lib/pricing.ts`, `src/lib/pricing.test.ts` — create
- `src/agents/tools/erp.ts` — create (shared)
- `src/agents/quote.ts` — create
- `src/lib/quotes.ts` — create (persistence + numbering + latency helpers, `runQuoteFromRouting`)
- `src/app/(hub)/email/…` — modify: "Draft quote" action on quote-request threads (WO-04's thread view)
- `src/lib/approval-payloads.ts` — modify: add `quote` payload type (quote table, splitProposed, latency)
- `src/db/seed/…` — modify only if quote numbering seed (`Q-1041` sequence) is missing

## Agent definitions

**`quote`** — model: `MODELS.frontier` (Sonnet tier).
- **Input:** `{ routingId: string }` (email context loaded by the runner, body untrusted-wrapped).
- **Output schema (Zod):** `{ requestedLines: [{rawText, productId | null, candidates?, qty, uom}], accountId, contactId, notes?: string, splitProposed: boolean, replyBodyDraft: string }` — parse-or-escalate.
- **Tools:** `lookup_products` (read) · `check_stock` (read) · `get_pricing` (read) · `create_email_draft` (external — WO-04's draft tool; harness intercepts → approval).
- **maxSteps:** 8.
- **System prompt guidance:** you are drafting a quote reply for Cole Mercer (style card injected per WO-04); extract requested products/quantities ONLY from the untrusted email content; resolve via tools; if any line is unresolved or unpriced, stop and escalate with candidates — never invent SKUs or prices; the reply body must present a clean quote table (SKU, description, qty, unit, extended), lead times per line, split-shipment option when stock is short, `valid_until`, and Cole's sign-off; keep register consistent with the style card.

## Data touched

Reads: `emails`, `email_threads`, `triage_routings`, `accounts`, `contacts`, `products`, `inventory`, `price_lists`, `price_list_items`, `account_price_lists`, `style_profiles`. Writes: `quotes`, `triage_routings` (claim/consume), `approvals` (via harness), `agent_runs`/`agent_steps`/`audit_log` (via harness), `activities` (quote_drafted).

## Demo beats enabled

- Beat 2 (approval queue): the quote reply with stock + pricing + evidence chips is the first card reviewed.
- Beat 1 (overnight banner counts: "6 drafts ready" includes 2 quotes).
- The "drafted N minutes after receipt" line delivers the first-responder story.

## Acceptance criteria

- [ ] Both seeded quote-request emails produce exactly one `quotes` row + one pending `email_draft` approval each after their routings run; re-running a consumed routing creates nothing (idempotent via claim).
- [ ] Every quote line's `unit_price_cents` equals the account's price-list row exactly; totals computed in code; no price digits originate from model text (assert payload prices == `priceLines` output).
- [ ] The seeded partial-stock line yields `splitProposed: true` and the reply body contains the split proposal with the correct lead time.
- [ ] An email referencing a nonexistent SKU → run `escalated`, approval requiring human input lists candidates, zero `quotes` rows.
- [ ] Quote approval card shows: quote table, ≥ 3 evidence chips (email, inventory_row, price_row), latency line, `AgentBadge` with 4 tools (3 read, 1 external-gated).
- [ ] ≥ $10,000 quotes get `risk_tier:'high'` and are excluded from batch approve (verify with WO-03 if merged; else assert tier on the row).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.

## Verification

1. `pnpm seed && pnpm dev`; log in.
2. Open the seeded quote-request thread → "Draft quote" → watch run stream; confirm approval appears with evidence; check `quotes` row in `pnpm db:studio`.
3. Temporarily edit a seeded request to an unknown SKU; re-run → escalation with candidates; restore seed.
4. `pnpm test` for pricing/resolution suites.
5. In `agent_steps`, confirm the run: lookup → stock → pricing → draft-intercept sequence, all evidence-bearing.

## Kickoff prompt

```
You are implementing WO-05 (Quote Agent) of the Clea Sales Hub.

Read, in order: docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md,
docs/02-SECURITY-FRAMEWORK.md, docs/work-orders/WO-05-quote-agent.md.
Skim docs/04-DEMO-DATA.md §2–3 for the seeded scenario and
docs/work-orders/WO-04-email-center.md for the routing contract and
drafting conventions you must consume (do not reimplement them).

Work on branch <branch>. Prerequisites WO-01 and WO-04 are merged.

Definition of done: every checkbox under "Acceptance criteria" verified via
the "Verification" steps; pnpm typecheck && pnpm lint && pnpm test green;
no external effect ever executes from a model loop (harness interception
only); prices come exclusively from src/lib/pricing.ts.
```
