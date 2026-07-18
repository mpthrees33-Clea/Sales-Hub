# WO-03 — Approval Inbox, Policy-Gated Execution & Audit UI

**Size:** L · **Depends on:** WO-01 (merged) · **Parallel track:** A (alongside WO-02; independent of tracks B–F)

## Objective

Build the hero surface: the keyboard-first approval inbox per 03-DESIGN-SYSTEM §4, the approval-resolution server action that is the *only* code path executing external effects (behind the deterministic policy gate), and the audit trail UI. Every agent in every other WO terminates here; this WO makes "Drafts only — humans send" visible, fast, and filmable. The 2-hours→10-minutes montage is literally this interaction.

## Clea framework alignment

- **Human handoff built in / "Drafts only — humans send"** — approval resolution is an authenticated server action, unreachable by any agent tool (02 §2.1–2.2).
- **Deterministic policy gate** — re-run in code at execution time: recipient allowlist, rate caps, attachment origin, risk tiers (02 §2.3).
- **"Every answer shows its source"** — evidence chips with drill-through to the email, PDF page highlight, or price row.
- **Permissioned Tools made visible** — `<AgentBadge />` with the acting agent's scoped-tool list and effect tags on every card (02 §6).
- **Email Fine-tune flywheel** — every human edit recorded as a diff in `approvals.edits` (future tone-tuning dataset, 02 §3).
- **Append-only audit** — every resolution, block, and expiry lands in `audit_log`; the audit view proves it.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md`, `docs/02-SECURITY-FRAMEWORK.md` (all — this WO gives it a UI), `docs/03-DESIGN-SYSTEM.md` §3–4 and §6, `docs/04-DEMO-DATA.md` §3 (queue composition after the nightly run).
- WO-01 merged: `approvals`/`audit_log` schema, `policy-gate.ts` (`runPolicyGate`, `assignRiskTier`), providers, `requireSession()`, component stubs (`ApprovalCard`, `EvidenceChips`, `AgentBadge`, `RiskTierTag`, `DraftEditor`, `PdfViewer`), `audit()`, `getDemoNow()`.

## Scope / Non-goals

**In scope:** `/approvals` queue + focused card per kind; keyboard map + legend; evidence chips + source panels; inline edit with save-and-approve + diff recording; resolution server action (gate → execute → audit → expiry); batch approve (low tier only); approve feedback animations; "Why can't agents send email?" popover; audit trail view; live rail badge count; `--with-approvals` seed fixture; phone-width excellence.

**Non-goals:** creating approvals (agents in WO-04/05/06/07/09/14 do that); the nightly workflow (WO-08); modifying harness draft-time behavior; PDF field→bbox anchors (WO-06 supplies them — render page-level highlight until then); live email sending (Demo `EmailProvider` marks sent in-app); no changes to `policy-gate.ts` rules — if a rule seems wrong, flag it, don't fork it.

## Tasks

1. **Seed fixture flag.** `pnpm seed --with-approvals` (dev-only; WO-13 reconciles): inserts one pending approval per kind — `email_draft`, `quote`, `sales_order`, `sample_order` (×2, low tier, batch demo), `opportunity_update`, `submittal` — each with a plausible `proposed_action` typed per 02 §3, real evidence refs into seeded rows (an email id, a PO PDF page, a `price_list_items` row, a transcript segment, an inventory row), a backing `agent_runs` row with steps, correct `assignRiskTier` tiers, plus one approval pre-aged past expiry. Fixture content obeys the 04 consistency rule (referenced SKUs/people/quotes exist).
2. **Queue layout** (03 §4). `/approvals`: left list grouped by risk tier (high → standard → low), then kind within tier; each row: kind icon, one-line summary, agent name, `<RiskTierTag />`, age (demo-clock relative). Right: focused card. Everything pre-fetched — selection changes render instantly (draft-ahead). URL state `?id=` for deep links (ticker/banner CTAs land here).
3. **Focused card per kind.** One renderer per kind inside a shared `<ApprovalCard />` frame (header: `<AgentBadge />`, `<RiskTierTag />`, age/expiry countdown, run-trace link; footer: Approve / Edit / Reject actions):
   - `email_draft` — rendered as an email: from (rep), to/cc, subject, body (text-only, sanitized), attachment list resolving asset ids to titles. Looks like mail, not JSON.
   - `sales_order` — order form: customer + ship-to, lines table (SKU, description, qty, UOM, unit price, extended), totals, linked customer PO number, and the seven-layer validation checklist from `purchase_orders.validation` (pass green / fail red with detail).
   - `opportunity_update` — field-level diff old→new (stage, value, probability, next_step, expected_close), plus proposed new-opportunity rows rendered as "NEW".
   - `sample_order` — items (product, size, qty) with swatch thumbnails, contact + ship-to, low-tier framing.
   - `quote` — quote form: lines with pricing + `source_row_id` provenance, totals, valid-until; validation checklist where present.
   - `submittal` — package outline: project, product list, section list with doc kinds.
   - Fallback generic renderer (typed key/value + raw JSON details) for `scene_send` and any future kind — never a blank card.
4. **Keyboard map** (03 §4, exact): `j`/`k` next/prev · `a` approve · `e` edit · `r` reject · `enter` open evidence panel · `shift+A` batch-approve (enabled only when the current group is `low` tier; confirm dialog listing count and kinds) · `?` shortcut legend dialog. Implement as a `useApprovalKeys` hook; keys disabled while any input/textarea is focused; in edit mode `⌘/Ctrl+Enter` = save-and-approve, `Esc` = cancel edit. Legend also lists these two.
5. **Evidence chips + source panel.** Finish `<EvidenceChips />`: one chip per evidence item, icon by type (email / pdf_page / price_row / transcript_segment / inventory_row). Click or `enter` opens the source panel (right-side sheet; bottom sheet at phone width):
   - `email` → read-only email view of the referenced message (subject, from, received-at, body).
   - `pdf_page` → `<PdfViewer />` rendering the referenced page with a highlight — bounding box when the ref carries one, whole-page wash until WO-06 provides anchors.
   - `price_row` → popover/panel with the `price_list_items` row: price list + tier, SKU, unit price, min qty.
   - `transcript_segment` → speaker-labelled excerpt with timestamps.
   - `inventory_row` → on-hand / allocated / lead-time snapshot.
   Each panel shows the evidence `quote` string and a monospace ref id.
6. **Finish `<PdfViewer />`.** Client component rendering PDF page images (pdf.js) from a Blob URL with an absolutely-positioned highlight layer driven by `{page, bbox?}`. Page navigation, fit-width, loading skeleton. Contract stays as WO-01 stubbed it — WO-06 reuses this untouched.
7. **Inline edit path** (03 §4 — optimize it; most drafts get tweaked). `e` flips the focused card to inline editing in place — never a modal round-trip. `email_draft` uses the finished `<DraftEditor />` (to/cc/subject locked-but-editable, body rich-text-lite, attachments picked from the asset library only). Structured kinds get field-level inline editors (qty, price, next_step, etc.). Single primary action **Save & approve** (`⌘/Ctrl+Enter`) submits resolution `edit_approve` with the full edited `proposed_action`; the server computes and records the diff.
8. **Diff recording.** `src/lib/approvals/diff.ts`: deep-compare original vs edited `proposed_action` → `[{path, old, new}]`; stored in `approvals.edits`; unit-tested (nested objects, arrays of lines).
9. **Resolution server action** — the only executor in the codebase. `src/app/(hub)/approvals/actions.ts` `resolveApproval({id, resolution: 'approve'|'edit_approve'|'reject', edited?})`:
   1. `requireSession()`; load approval `FOR UPDATE`; must be `status:'pending'`.
   2. **Expiry check** against `getDemoNow()` (72h demo-clock default from creation): expired → set `status:'expired'`, `audit('approval.expired')`, return — never execute.
   3. `reject` → `status:'rejected'`, `resolved_at`, `approver_user_id`, `audit('approval.rejected')`, return. **No gate call, no provider call, no side effects — rejecting never executes.**
   4. approve paths → **re-run `runPolicyGate(approval, ctx)` at execution time** (recipient allowlist, rate caps, attachment origin, tier rules) against the resolved (possibly edited) payload. Blocked → write `blocked_reason` (additive jsonb column on `approvals` — owner-WO column per 01 §4), `audit('policy.blocked', {rule, reason})`, keep `status:'pending'`, return a typed blocked result. Never partial-execute.
   5. Execute through the provider layer via `src/lib/approvals/execute.ts` (kind → effect): `email_draft`/`quote` reply → `EmailProvider.createDraft` + `send` (Demo marks sent in-app, appends the outbound email to the thread); `sales_order` → `ErpProvider` creates/finalizes the SO row, PO `status:'converted'`; `sample_order` → `status:'ordered'`; `opportunity_update` → apply field deltas to `opportunities` (+ insert new ones) and append an `activities` row; `submittal` → mark package status.
   6. Set `status:'approved'|'edited_approved'`, store `edits` diff, `resolved_at`, `approver_user_id`; `audit('approval.approved')` + `audit('effect.executed', {provider, ref})`. All within one transaction where the effect is DB-local; provider call failure → no status change, surfaced error, audit `effect.failed`.
10. **Blocked state UI.** A gate-blocked approval renders a visible red "Blocked by policy gate" banner on the card: rule name, human-readable reason ("Recipient rob@unknown-co.example.net is not an allowlisted contact"), and a "view audit entry" link. Card stays in the queue, actions remain (edit to fix recipient, or reject).
11. **Batch approve.** `shift+A` → confirm dialog ("Approve 2 low-tier items?" with kind summary) → sequential `resolveApproval` per item (gate re-runs per item; one block does not halt the rest); result toast summarizes approved/blocked counts. Structurally impossible above `low`: the action validates tier server-side, not just in UI.
12. **Approve feedback** (03 §4). On resolve: card slides out, queue count decrements, audit toast "Sent · logged #a1b2c3" (first 6 of the audit row id, monospace). Snappy (<200ms perceived), `prefers-reduced-motion` → fade only. This is the montage — make it buttery.
13. **"Why can't agents send email?" popover.** Info icon in the queue header + on every `email_draft` card. Copy (verbatim):
    > **Why can't agents send email?**
    > Our agents read untrusted content — inbound mail, attached PDFs, meeting recordings. Anything that reads untrusted content can be lied to, so no such agent is ever given the power to act on the outside world. Tools that would send, order, or commit are structurally disabled: calling one creates a proposal in this queue instead. The send happens only after you approve — executed by deterministic code that re-checks recipients, rate limits, and attachment origin. **Drafts only — humans send.** That isn't a policy we ask the model to follow; it's how the system is built.
14. **Audit trail view.** `/approvals/audit` (tab beside the queue): filterable, paginated read-only table of `audit_log` — timestamp (demo-clock TZ), actor (`agent:<name>` / `user:<id>` / `system`), action, object, detail summary; monospace ids; "Append-only" header badge. Read-only by construction (no mutation actions exist).
15. **Rail badge + expiry sweep.** Make the WO-01 Approvals rail badge live (pending count, revalidated on resolution). On queue load, sweep `pending` rows past expiry → `expired` + audit row, so stale items never render as actionable.
16. **Phone width** (03 §2 — "approve from the truck" is filmed here). At <640px: list is full-screen; selecting opens the card as a full-screen layer with back; Approve / Edit / Reject as a fixed bottom action bar with ≥44px targets; evidence as bottom sheets; keyboard optional throughout. Test at 390px.
17. **Tests.** Unit: diff recording; expiry never executes; reject never calls gate/provider; gate-block leaves status pending + writes audit; batch refuses non-low tier server-side. Integration (seeded): approve an `email_draft` → Demo provider marks sent + audit rows exist.

## Files to create or modify

- `src/app/(hub)/approvals/page.tsx` — replace stub (queue + focused card, `?id=` deep link)
- `src/app/(hub)/approvals/actions.ts` — `resolveApproval`, `resolveApprovalsBatch`
- `src/app/(hub)/approvals/audit/page.tsx` — audit trail view
- `src/app/(hub)/approvals/_components/`: `queue-list.tsx`, `card-email-draft.tsx`, `card-sales-order.tsx`, `card-quote.tsx`, `card-sample-order.tsx`, `card-opportunity-update.tsx`, `card-submittal.tsx`, `card-generic.tsx`, `evidence-panel.tsx`, `blocked-banner.tsx`, `batch-confirm.tsx`, `why-popover.tsx`, `shortcut-legend.tsx`, `use-approval-keys.ts`
- `src/lib/approvals/execute.ts`, `src/lib/approvals/diff.ts`, `src/lib/approvals/expiry.ts`
- `src/components/approval-card.tsx`, `evidence-chips.tsx`, `agent-badge.tsx`, `risk-tier-tag.tsx`, `draft-editor.tsx`, `pdf-viewer.tsx` — finish WO-01 stubs (shared; keep prop contracts)
- `src/db/schema.ts` — additive only: `approvals.blocked_reason` jsonb (shared file, explicitly listed)
- `src/db/seed/index.ts` + `src/db/seed/fixtures/approvals.ts` — `--with-approvals` flag (shared file, explicitly listed)
- `src/app/(hub)/layout.tsx` — live rail badge count (shared file, explicitly listed)
- `tests/approvals-*.test.ts`

Do not touch `src/harness/` beyond consuming `runPolicyGate`/`assignRiskTier`; do not touch other modules' directories.

## Agent definitions

None. This WO builds the surface that *resolves* agent output; it defines no agents. It consumes `agent_runs`/`agent_steps` for badges and trace links, and enforces that no agent-reachable code path can resolve an approval.

## Data touched

Read/write: `approvals` (status, edits, blocked_reason, resolved_at), `audit_log` (append via `audit()` only). Execution writes per kind: `emails`/`email_threads` (Demo send), `sales_orders`, `purchase_orders` (status), `sample_orders`, `opportunities`, `activities`, `submittal_packages`, `quotes`. Reads: `agent_runs`/`agent_steps` (badge, trace), `contacts`/`accounts` (allowlist context), `assets`/`pds_documents` (attachments), `price_lists`/`price_list_items`, `inventory`, `transcripts`, `products`, `demo_state` (via `getDemoNow()`).

## Demo beats enabled

- "The rep clears the approval queue in 10 minutes — work that used to take 2 hours" — the j/a/e keyboard montage with slide-out feedback and audit toasts.
- Batch-approving the two low-tier sample confirmations (`shift+A` + confirm) from 04 §3's queue.
- The escalated PO's blocked/escalated visibility — validation checklist red at layer 3, "Grounded or it escalates" on screen.
- Evidence chips → source drill-through — "Every answer shows its source", filmed on a quote card's price row and the PO's PDF page.
- "Approve from the truck" — phone-width approval of the meeting follow-up draft.
- The "Why can't agents send email?" popover — the trifecta-separation selling point, filmed (02 §6).

## Acceptance criteria

- [ ] With `pnpm seed --with-approvals`: queue renders grouped high → standard → low, then by kind; each of the six kinds renders its native card (email looks like an email, SO like an order form with the seven-layer checklist, opportunity update as old→new field diff); generic fallback proven with a synthetic `scene_send` row.
- [ ] Every card shows `<AgentBadge />` (popover lists scoped tools with read/internal/external-gated effect tags), `<RiskTierTag />`, evidence chips, and a working run-trace link.
- [ ] Full keyboard map works: `j`/`k`/`a`/`e`/`r`/`enter`/`shift+A`/`?`; legend dialog lists all; keys inert while editing; `⌘/Ctrl+Enter` saves-and-approves from edit mode.
- [ ] Evidence chips open the correct source panel per type: email view, PDF page with highlight via `<PdfViewer />`, price-row popover, transcript segment, inventory row — each showing the evidence quote and ref.
- [ ] **Rejecting never executes:** reject leaves providers untouched (no sent mail, no status changes elsewhere), sets `rejected`, writes the audit row — asserted by test.
- [ ] **Editing records a diff:** edit body + a line qty → save-and-approve → `status:'edited_approved'` and `approvals.edits` contains exact `{path, old, new}` entries — asserted by test.
- [ ] Approving executes exactly once through the provider layer: Demo `EmailProvider` marks the draft sent and the outbound email appears on the thread; `audit_log` gains `approval.approved` + `effect.executed` rows.
- [ ] **Policy gate re-runs at execution time; a blocked item surfaces a visible blocked state and an audit row:** editing a recipient to a non-allowlisted address then approving shows the red blocked banner with rule + reason, status stays `pending`, `policy.blocked` is in the audit view, nothing executed — asserted by test and manual flow.
- [ ] Batch approve: only offered/accepted for `low` tier (server-side enforced), confirm dialog shows count, per-item gate runs, summary toast reports approved/blocked counts.
- [ ] Expired approvals (pre-aged fixture) render as `expired`, are excluded from actionable queue, and can never execute — asserted by test.
- [ ] Approve feedback: slide-out + count decrement + "Sent · logged #……" toast; fade-only under `prefers-reduced-motion`.
- [ ] "Why can't agents send email?" popover shows the specified copy verbatim.
- [ ] Audit view lists resolutions, blocks, and expiries with actor/action/object; no mutation affordance exists.
- [ ] **All interactions work at phone width (390px):** browse, open card, approve, edit-and-approve, reject, evidence sheets, batch confirm — bottom action bar, ≥44px targets.
- [ ] Rail badge count is live and decrements on resolution.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass.

## Verification

```bash
pnpm seed --with-approvals && pnpm dev
pnpm test -- approvals          # diff, reject-never-executes, expiry, gate-block, batch-tier tests
pnpm typecheck && pnpm lint
pnpm db:studio                  # inspect approvals.status/edits/blocked_reason and audit_log after flows
```

Manual: log in → `/approvals`. Keyboard-only pass: `?` legend, `j/k` through the queue, `enter` on each evidence chip type (email, PDF highlight, price row), `a` an email draft → toast + `db:studio` shows sent email + audit rows. `e` on a quote → change a qty → `⌘Enter` → check `edits` diff. `r` a card → confirm nothing executed. Edit an email draft's recipient to `nobody@not-allowlisted.example.net` → approve → blocked banner + `policy.blocked` audit row, status still pending. Select the low-tier group → `shift+A` → confirm → both resolve. Open `/approvals/audit` → all rows present. DevTools 390px: repeat approve, edit-approve, reject, evidence — all flows via touch. `pnpm seed --with-approvals` again to reset state.

## Kickoff prompt

```
You are implementing WO-03 for Clea Sales Hub. Read, in order and completely:
docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md, and docs/work-orders/WO-03-approval-inbox.md
(the WO directs you into docs/02 in full, docs/03 §3–4/§6, and docs/04 §3 — read those too).

Work on branch {{BRANCH}} (suggested: wo-03-approval-inbox). Conventional commits, e.g.
feat(approvals): …  WO-01 is merged: build on its approvals/audit schema, policy gate,
providers, session helper, and component stubs. The resolution server action is the ONLY
code path that executes external effects; it must re-run the policy gate at execution
time and write audit rows for every outcome. Touch only the files WO-03 lists; never
modify policy-gate rules — flag conflicts instead.

Definition of done: every checkbox in WO-03 "Acceptance criteria" is true and every
command and manual flow in "Verification" passes — six native card kinds, the full
keyboard map, evidence drill-throughs, edit-with-diff save-and-approve, reject that
never executes, visible policy-gate blocked state with audit row, low-tier-only batch,
expiry handling, the verbatim "Why can't agents send email?" popover, and every
interaction working at 390px phone width. Finish with pnpm typecheck && pnpm lint &&
pnpm test green.
```
