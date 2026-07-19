# WO-14 — Submittal Package Agent

**Size:** M · **Depends on:** WO-01, WO-10 (consumes WO-04's `submittal` routing when merged) · **Parallel track:** E (after WO-10)

## Objective

Compress the single biggest time sink in architectural product sales — assembling submittal packages (research: 8–12 hours each) — into minutes: pick a project and products, the agent proposes the package composition, a deterministic assembler merges the actual PDFs (generated cover sheet + PDS + install guides + test reports + warranties, with dividers and page numbers), and the result lands in the approval queue with a transmittal email draft. This is the vertical differentiator no horizontal AI sales tool touches.

## Clea framework alignment

- **"Grounded or it escalates"** — a product missing a required document escalates; it is never silently omitted from a compliance package.
- **"Every answer shows its source"** — the approval lists every included document and why.
- **"Business grounding, deterministic math"** — the LLM proposes composition; pdf-lib does the assembly; page numbers and ordering are code.
- **Human handoff built in** — the package and its transmittal email are approvals, not sends.

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md`, `docs/02-SECURITY-FRAMEWORK.md` §3, `docs/04-DEMO-DATA.md` (seeded "Harborview Medical Ph2" submittal request + doc fixtures).
- WO-01 merged (schema `submittal_packages`, harness, Blob, pdf-lib in deps). WO-10 merged (PDS library, `/catalog/documents`, `isAttachable`). WO-04's routing contract consumed if merged (degrade: manual builder only).

## Scope / Non-goals

**Scope:** `submittal` agent; deterministic PDF assembler; `/submittals` list + builder flow; routing consumption for the seeded Harborview request; approval (kind `submittal`) + optional transmittal email draft; escalation on missing docs.

**Non-goals:** CSI three-part spec authoring; architect-side review portals; e-signatures; revision/resubmittal cycles ("revise & resubmit" tracking is roadmap); LEED/sustainability documentation sections.

## Tasks

1. **Package composition schema** (`src/lib/submittals.ts`): typed structure
   `{coverSheet: {projectName, projectAddress, gcName, architectName, repName, repContact, date, packageTitle, submittalNumber}, sections: [{productId, docs: [{pdsDocumentId, kind}], note?}], sampleRequestNote?: string}` (Zod). Section doc-kind requirements config: `pds` + `install` required; `test_report` + `warranty` included when present (config const, documented).
2. **`submittal` agent** (`src/agents/submittal.ts`) — see Agent definitions. Given project + selected products (+ optional source-email context untrusted-wrapped when routed), proposes the composition: which docs per product from `pds_documents`, cover-sheet fields from project/account/rep data, a sample-request note when the source email asked for samples. Missing REQUIRED doc for any product → `EscalationError('missing_document', {productId, kind})` — the run escalates with a human-resolvable approval ("proceed without / remove product / upload doc").
3. **Deterministic assembler** (`src/lib/submittal-assembler.ts`, no LLM): input = validated composition → output PDF via pdf-lib:
   - Cover sheet page generated from a fixed clean template (Clea aesthetic: type-driven, numbered sections listing contents).
   - Per product: a divider page (product name, SKU, section number) then its docs concatenated in kind order (pds, install, test_report, warranty).
   - Global page numbers stamped bottom-right ("Page n of N"); table of contents on the cover listing each section's starting page.
   - Output → `putBlob` → `submittal_packages` row (`sections` jsonb, `output_blob_url`, `status:'pending_approval'`).
4. **Approval.** Kind `submittal`, risk tier `standard`; `proposed_action` = composition + output blob ref; `evidence` = one item per included doc (`{type:'pdf_page', ref: pdsDocumentId, quote: '<kind> for <sku>'}`) + source email when routed. WO-03's card renders the composition list + a PdfViewer preview of the assembled package. Optional second approval: transmittal `email_draft` to the requester (via WO-04's draft tool) with the package attached — the assembled PDF is registered as an `assets` row — add `submittal` to the assets kind enum (schema owner-WO addition) so the attachment-origin check passes cleanly.
5. **Builder UI** (`src/app/(hub)/submittals/`): list (packages w/ status, project, product count, date) + `new` flow: pick project → pick products (catalog multi-select; hero flow = Harborview + 3 products incl. `MS-WG-1147`) → agent proposes → review composition (per-section doc checklist, editable includes, cover-sheet field edit) → assemble → approval created; escalation state shows exactly which doc is missing for which product.
6. **Routing consumption.** `runSubmittalFromRouting(routingId)`: claim → parse project/products hint from the seeded Harborview email → prefill the builder (deep link `submittals/new?routing=…`) — the nightly run (WO-08) surfaces it as a prepared draft builder session rather than fully auto-assembling (human picks products; composition is where judgment lives). Document this choice in the module README block.
7. **Tests:** assembler (3-product composition → correct page count, TOC page numbers match section starts, page stamps present via pdf-lib read-back); missing-required-doc escalation; composition Zod round-trip; assets-kind registration passes `isAttachable`.

## Files to create or modify

- `src/lib/submittals.ts`, `src/lib/submittal-assembler.ts` + tests — create
- `src/agents/submittal.ts` — create
- `src/app/(hub)/submittals/page.tsx`, `submittals/new/page.tsx`, `submittals/[id]/page.tsx` — create
- `src/db/schema.ts` — modify: add `submittal` to assets kind enum
- `src/lib/approval-payloads.ts` — modify: `submittal` payload type

## Agent definitions

**`submittal`** — model: `MODELS.frontier`.
- **Input:** `{projectId, productIds: string[], routingId?: string}` (routed email body untrusted-wrapped by the runner when present).
- **Output schema:** the composition schema from task 1 — parse-or-escalate.
- **Tools:** `get_project_context` (read: project, account, GC/architect contacts) · `list_product_documents` (read: `pds_documents` per product w/ kinds) · `propose_submittal` (external → approval via harness). No send tools.
- **maxSteps:** 6.
- **System prompt guidance:** compose a compliance package an architect will accept first pass ("no exceptions taken"); include every required doc kind per product; never claim a document exists that `list_product_documents` did not return; cover-sheet fields only from tool-returned project data; if the source email requests samples, add the sample-request note referencing WO-09's flow.

## Data touched

Reads: `projects`, `accounts`, `contacts`, `products`, `pds_documents`, `triage_routings`, `emails`. Writes: `submittal_packages`, `assets` (package registration), `approvals`/`agent_runs`/`agent_steps`/`audit_log` (via harness), `activities` (submittal_drafted).

## Demo beats enabled

- Beat 7 in full: project + 3 products → assembled package with cover sheet + TOC → review → approve. Spoken line: "8 hours → 4 minutes."
- Beat 1: the seeded Harborview request appears in the overnight surface as a prepared builder session.

## Acceptance criteria

- [ ] Harborview + 3 products (incl. `MS-WG-1147`) → assembled PDF: cover sheet w/ correct project/GC/architect/rep fields, TOC page numbers matching actual section starts, divider per product, all required docs in kind order, "Page n of N" stamps throughout.
- [ ] Removing a required seeded doc (test fixture) → run escalates naming the product + missing kind; no package produced; resolution options rendered.
- [ ] Approval card lists every included doc as evidence + previews the package; approving registers the package as an attachable asset; optional transmittal draft references the attachment legally (origin check passes).
- [ ] Routed path: the seeded submittal_request routing deep-links into a prefilled builder; claim semantics respected (no double-consumption).
- [ ] Assembly of the hero package completes in < 30s on seeded fixtures.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.

## Verification

1. `pnpm seed && pnpm dev` → `/submittals/new` → hero flow → open the assembled PDF page by page (cover, TOC, dividers, stamps).
2. Delete one required fixture doc in a test branch of the seed → rerun → verify escalation UX; restore.
3. Approve the package → transmittal draft appears with the package attached; check asset row + audit trail.
4. `pnpm test` (assembler read-back suite).

## Kickoff prompt

```
You are implementing WO-14 (Submittal Package Agent) of the Clea Sales Hub.

Read, in order: docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md,
docs/02-SECURITY-FRAMEWORK.md §3, docs/work-orders/WO-14-submittals.md.
Consume WO-10's document library and WO-04's routing contract — do not
reimplement either.

Work on branch <branch>. WO-01 and WO-10 are merged.

Definition of done: every Acceptance criteria checkbox verified via the
Verification steps; composition proposed by the agent, assembly 100%
deterministic (pdf-lib); missing required docs escalate, never silently
omit; pnpm typecheck && pnpm lint && pnpm test green.
```
