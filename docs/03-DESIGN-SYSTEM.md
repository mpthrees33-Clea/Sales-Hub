# 03 — Design System & UX Specification

> The hub must look like it belongs to clea-solutions.ai: minimalist,
> enterprise, technical-documentation aesthetic — an instrument panel, not a
> consumer app. "Private by default" energy. This doc defines the shell, the
> visual language, and the approval-inbox UX (the hero surface).

---

## 1. Brand alignment

- **Tone**: calm, precise, engineered. Numbered sections, monospace accents for
  ids/SKUs/run-ids, generous whitespace, thin rules. No gradients-for-fun, no
  confetti. The wow comes from *content* (live agent traces, evidence chips,
  generated scenes), not chrome.
- **Palette**: near-black/near-white neutrals with ONE restrained accent for
  interactive elements + semantic colors (green pass / amber escalated / red
  blocked). Dark mode is the primary demo mode (films better); light mode must
  work. Use shadcn/ui tokens; define palette once in `globals.css`.
- **Type**: Geist Sans + Geist Mono (Vercel-native, matches ecosystem story).
- **Language**: use Clea vocabulary verbatim in UI copy: "Mission Control",
  "Permissioned Tools", "Grounded or it escalates", "Every answer shows its
  source", "Human handoff built in", "Drafts only — humans send".

## 2. App shell (WO-01 builds skeleton; WO-02 finishes)

- Left rail nav (icons + labels): Mission Control, Approvals (with live count
  badge), Email, PO Intake, Meetings, Samples, Catalog, Scenes, Routes,
  Submittals, Settings. Collapsible on mobile — the "approve from the truck"
  scene is filmed on a phone-width viewport, so Approvals and Email must be
  flawless responsive.
- Top bar: demo-clock indicator (subtle "DEMO • Tue 6:55 AM" chip), global
  search (cmd-k, stretch), rep avatar.
- **Agent activity ticker**: thin strip showing live/recent runs ("PO Intake ·
  validated 7/7 · 41s") — links to run trace. This is Mission Control ambience;
  keep it everywhere.

## 3. Shared components (build once in WO-01/02, reuse everywhere)

| Component | Spec |
|---|---|
| `<EvidenceChips />` | small chips per evidence item: icon by type (email/PDF page/price row/transcript/inventory), click → source panel (email view, PDF page w/ highlight, table row) |
| `<AgentBadge />` | agent name + scoped-tool count; popover lists tools w/ effect tags (read/internal/external-gated) |
| `<RiskTierTag />` | low/standard/high with semantic color |
| `<RunTrace />` | timeline of `agent_steps`: LLM calls, tool calls (name+ms), validations (pass/fail), escalations — collapsible, monospace |
| `<ApprovalCard />` | see §4 |
| `<KpiTile />` | value, delta vs target, tiny sparkline; no chart-junk |
| `<DraftEditor />` | email-style editor: to/cc/subject locked-but-editable, body rich-text-lite, attachment list from asset library |
| `<PdfViewer />` | renders PDF page images w/ bounding highlight for a cited field (WO-06 needs field→page anchors) |

## 4. The approval inbox UX (hero — WO-03; patterns stolen from Superhuman/Fyxer)

- **Queue layout**: left = list (grouped by risk tier, then kind), right =
  focused card. Draft-ahead: everything is pre-generated; review starts
  instantly.
- **Keyboard-first**: `j/k` next/prev · `a` approve · `e` edit · `r` reject ·
  `enter` open evidence · `shift+a` batch-approve (low tier only, confirm
  dialog). Show a shortcut legend (`?`). Filmable speed is the point.
- **The card**: proposed action rendered natively per kind (email draft looks
  like an email; SO looks like an order form; opportunity update shows a
  field-level diff old→new), evidence chips row, `<AgentBadge />`,
  `<RiskTierTag />`, and for PO/quote kinds the validation-layer checklist.
- **Optimize the EDIT path** (research: most drafts get tweaked, not
  rubber-stamped): single keypress into inline editing, save-and-approve as one
  action, diff recorded. Never force a modal round-trip.
- **Approve feedback**: card slides out, queue count decrements, audit toast
  ("Sent · logged #a1b2c3"). The 2-hours→10-minutes montage is literally this
  interaction — make it buttery.

## 5. Surface-specific notes

- **Mission Control (WO-02)**: top row = 4 KpiTiles (sales created wk/mo,
  invoiced wk/mo vs targets); "Overnight" banner card (nightly-run summary +
  CTA to Approvals); Today's Docket (meetings w/ prep-notes + leave-by chips);
  Route map preview (static map thumb → WO-12); Overnight Changes feed
  (Rox-style per-account deltas); agent runs panel w/ `<RunTrace />` drill-in.
- **Email (WO-04)**: three-pane; triage category pills on threads w/ confidence;
  "Draft ready" indicator jumps to approval; noise auto-archived visibly.
- **PO Intake (WO-06)**: split view — left PDF page images, right extracted
  fields; hovering a field highlights its source box/page; seven-layer
  checklist with pass/fail + detail; escalation state shows exactly which layer
  failed and why ("Grounded or it escalates" on-screen).
- **Meetings (WO-07)**: record button (MediaRecorder) w/ waveform; transcript
  with speaker-colored segments; summary + extracted action items + CRM-delta
  panel; follow-up draft CTA into Approvals.
- **Scenes (WO-11)**: gallery + generator (pick product → upload/pick room
  photo → generate); before/after slider; "Attach to reply" action.
- **Empty states**: every list ships a designed empty state with Clea copy —
  the video will show some.

## 6. Quality bar

Responsive (desktop-first, phone-critical for Approvals/Email/Meetings),
`prefers-reduced-motion` respected, semantic HTML + focus states (keyboard UX
is a feature), skeleton loaders on all async panels, dark-mode contrast checked.
No lorem ipsum anywhere — seeded content only (see `04-DEMO-DATA.md`).
