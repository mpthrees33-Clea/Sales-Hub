# DEMO-SCRIPT — Clea Sales Hub, shot by shot

The film-day contract: **reset → simulate → identical counts, every take.**
Between takes use only `/demo-control` (hidden, session-gated, audit-logged) —
never psql, never db-studio. Dark mode is the primary filming mode. The
"approve from the truck" beat (5) films at phone width.

## Pre-flight (once per filming session)

1. Deploy or `pnpm build && pnpm start` with the seeded database (`pnpm seed`).
2. Log in (`DEMO_LOGIN_PASSWORD`), open `/demo-control` in a second tab.
3. **Toggle DEMO chip** off for final footage; leave it on for transparency shots.
4. Confirm determinism once: `pnpm test:demo` (the two-takes proof) is green.

Between takes: `/demo-control` → **Reset day** (~1 s) → the app is back at
Tue 6:55 AM with the Monday batch unprocessed and an empty queue.

## The overnight queue (what Simulate Overnight always produces)

14 triaged (3 noise archived) · 9 drafts (2 quote drafts HIGH, 2 stock checks +
1 technical + 1 meeting follow-up STANDARD, 1 scheduling + 2 sample
confirmations LOW) · 1 validated PO → draft sales order (7/7 layers) ·
1 escalated PO (layer 3) · 2 sample orders LOW · 3 opportunity updates ·
1 morning brief · 1 prepared submittal builder session. 16 pending approvals.

---

## Beat 1 — Cold open: Mission Control at 6:55 AM (WO-02 / WO-08)

*Pre-shot: Reset day → Simulate overnight (from `/demo-control`).*

| Screen | Action | Suggested line | Feature | WO |
|---|---|---|---|---|
| `/dashboard` | Slow scroll from top | "6:55 AM. While Cole slept, his agents worked the inbox." | Mission Control | WO-02 |
| `/dashboard` overnight banner | Hover the banner | "Fourteen emails triaged, nine drafts ready, one PO already a draft sales order." | Morning brief counts | WO-08 |
| KPI tiles | Point at delta vs target | "Created and invoiced, tracked against target — no dashboards to build." | KPI tiles + sparklines | WO-02 |
| Morning brief card | Click through to the run trace | "Every number links to the run that produced it. Every answer shows its source." | Run trace, evidence | WO-02/08 |
| Agent ticker (top strip) | Let it cycle once | "That strip is live agent activity — this is a working system, not a mockup." | Agent activity ticker | WO-02 |

## Beat 2 — The approval queue, cleared keyboard-first (WO-03)

*Pre-shot: none (queue exists from beat 1's simulate).*

| Screen | Action | Suggested line | Feature | WO |
|---|---|---|---|---|
| `/approvals` | Show header: "16 pending · Human handoff built in · Drafts only — humans send" | "Nothing here was sent. Agents draft; Cole decides." | Human handoff built in | WO-03 |
| Queue list | Press `?` to flash the shortcut legend, then `j`/`k` through cards | "Superhuman for approvals — j, k, approve, next." | Keyboard-first queue | WO-03 |
| A quote draft (HIGH) | Press `e`, bump a quantity, approve | "Edit, then approve — the diff is recorded forever." | Edit-then-approve + diff | WO-03 |
| Low-tier group | `shift+A` batch-approve, confirm dialog | "Low-risk drafts clear in one keystroke — the policy gate decides what counts as low-risk, in code." | Batch approve (low only) | WO-03 |
| Toast / ticker | Pause on the executed toast | "Two hours of morning email — cleared in ten minutes." | Policy-gated execution | WO-03 |

## Beat 3 — PO Intake, the flagship (WO-06)

*Pre-shot: none (both POs processed by the overnight run).*

| Screen | Action | Suggested line | Feature | WO |
|---|---|---|---|---|
| `/po-intake` | Open the validated PO | "A PDF purchase order came in overnight." | IDP→PO pipeline | WO-06 |
| Split view | Click 2–3 extracted fields; watch the PDF highlight jump | "Every extracted field is anchored to the page it came from." | Grounded extraction | WO-06 |
| Validation panel | Scroll the seven layers, all green; point at elapsed | "Seven deterministic validation layers. Under a minute, no human typing." | Seven layers, 7/7 | WO-06 |
| Draft SO approval | Show the HIGH-tier sales order card | "The output is a draft sales order — still a human decision." | Draft SO approval | WO-06/03 |
| The escalated PO | Open it; point at layer 3's expected-vs-found | "This one didn't match — forty dollars off on a line total. It stopped. Grounded or it escalates." | Layer-3 escalation | WO-06 |

## Beat 4 — Docket + day route (WO-02 / WO-12)

*Pre-shot: none.*

| Screen | Action | Suggested line | Feature | WO |
|---|---|---|---|---|
| `/dashboard` docket | Point at the leave-by chips | "Three meetings today. Leave by 8:52 for the 9:30 — that math is meeting start minus live drive time minus buffer." | Leave-by chips | WO-12 |
| `/routes` | Scroll stops; hover a chip tooltip | "Deterministic geography — no model in this module. The amber chip means the Raleigh run collides with the lunch." | Tight-chip arithmetic | WO-12 |
| `/routes` map + CTA | Click **Open in Google Maps** | "One tap and the whole optimized day is in Google Maps." | Share deep link | WO-12 |

## Beat 5 — The meeting, filmed at phone width (WO-07 / WO-03)

*Pre-shot: `/demo-control` → **Jump clock — post-meeting afternoon** (Tue 4:15 PM,
morning meetings completed, transcript + follow-up staged).*

| Screen | Action | Suggested line | Feature | WO |
|---|---|---|---|---|
| `/meetings` (phone) | Open the Harborview site walk | "Cole recorded the site walk on his phone." | Meeting record | WO-07 |
| Transcript view | Scroll the diarized transcript | "Diarized, timestamped, searchable." | Transcript | WO-07 |
| Follow-up draft | Open the staged email-draft approval (phone) | "The follow-up is already drafted — walnut pricing at Ray's project tier, spec sheet and install guide attached. Every price traced to a price-list row." | Grounded follow-up | WO-07 |
| Approve (phone) | Tap approve from the approvals screen | "Approved from the truck." | Human handoff | WO-03 |

## Beat 6 — Room scene (WO-11)

*Pre-shot: none (2 hero scenes are seed fixtures; generation is user-triggered).*

| Screen | Action | Suggested line | Feature | WO |
|---|---|---|---|---|
| `/scenes` | Show the gallery + budget line | "Image generation is user-triggered, capped per day, and priced on screen — agents can't reach it." | Scene gallery + caps | WO-11 |
| `/scenes/new` | Pick Walnut Grain, pick the lobby photo, generate | "Swatch plus customer lobby photo…" | Scene studio | WO-11 |
| Scene detail | Drag the before/after slider slowly | "…photoreal walnut on their wall. Same room, same light." | Before/after slider | WO-11 |
| Attach action | Click **Attach to reply (register as asset)** | "One click and it's a legal attachment — because attachments only come from the library." | Attachment origin check | WO-11/03 |

## Beat 7 — Submittal package (WO-14)

*Pre-shot: none (the overnight run prepared the builder session from Ray's email).*

| Screen | Action | Suggested line | Feature | WO |
|---|---|---|---|---|
| `/submittals` | Point at the prepared row ("prepared overnight — open the builder") | "Ray asked for the Harborview submittal package last night. The agents staged it." | Routed prep | WO-14 |
| `/submittals/new?package=…` | Open — project + 3 products preselected; click **Propose composition** | "The model proposes the composition — from the document library only." | Composition agent | WO-14 |
| Review step | Show required-locked docs, editable optional ones | "Data sheets and install guides are required — the system won't let a compliance package silently drop one." | Grounded or it escalates | WO-14 |
| Assemble | Click **Assemble & queue for approval**; open the result | "Cover sheet, table of contents with real page numbers, dividers, page stamps — assembled by code, not a model. Eight hours of work, four minutes." | Deterministic assembler | WO-14 |
| Approval card | Show the package preview + evidence chips | "And it ships only after a human approves — with the transmittal email drafted, not sent." | Approval + transmittal | WO-14/03 |

## Beat 8 — Security close (WO-02 / WO-03, docs/02 §6)

*Pre-shot: Toggle DEMO chip back **on** for the transparency shot if desired.*

| Screen | Action | Suggested line | Feature | WO |
|---|---|---|---|---|
| `/approvals/audit` | Slow scroll of the append-only trail | "Every read, every draft, every approval, every execution — append-only, no delete path in the codebase." | Audit trail | WO-03 |
| Any approval card | Open the agent badge popover; point at read / internal / external tags | "Agents hold Permissioned Tools — reads are free, writes are internal, anything external stops here." | Permissioned Tools | WO-03 |
| Approvals header | Click **Why can't agents send email?** | "Not a policy. A structure. There is no send tool to steal." | The why popover | WO-03 |
| Approvals header, tight crop | Hold on "Drafts only — humans send" | **"Drafts only — humans send."** | The close | — |

---

## The two-takes proof (run before filming, and on stage if asked)

1. `/demo-control` → **Reset day** → walk beats 1–8. Note the queue: 16 pending,
   14 triaged, 9 drafts, 2 sample orders, 3 opportunity updates.
2. `/demo-control` → **Reset day** → walk it again. The counts are identical —
   same ids, same numbers, same order.
3. Automated equivalent: `pnpm test:demo` runs both takes and fails on any drift.
