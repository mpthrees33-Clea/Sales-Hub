# WO-10 — Catalog, PDS Library, Presentations & Marketing Assets

**Size:** M · **Depends on:** WO-01 · **Parallel track:** E (WO-14 stacks on this; WO-11 registers scenes into the asset library it builds)

## Objective

Build the product-facing spine of the hub: a browsable catalog with specs, stock, and swatches; the per-product PDS document library; the marketing-asset library that is the *only* legal source of email attachments hub-wide; and a simple presentation builder that assembles product slides into an in-app slideshow with a PDF export. Mostly CRUD + polish — the trust architecture depends on this being the attachment source of record.

## Clea framework alignment

- **Permissioned Tools / attachment-origin policy** — the asset library is what the policy gate checks attachments against; this WO makes that concrete.
- **"Every answer shows its source"** — PDS docs are the source documents that submittals (WO-14) and email attachments cite.
- Clea enterprise aesthetic — the catalog is the most "product brochure" surface; it must still read as an instrument panel (03 §1).

## Prerequisites

- Read `docs/00-MASTER-PLAN.md`, `docs/01-ARCHITECTURE.md` §2/§4, `docs/03-DESIGN-SYSTEM.md`, `docs/04-DEMO-DATA.md` §1.
- WO-01 merged (schema: `products`, `pds_documents`, `assets`, `presentations`; PdfViewer stub; Blob wiring; seeded catalog).

## Scope / Non-goals

**Scope:** `/catalog` (browse/search/filter, product detail w/ specs+stock+docs), PDS library views + PdfViewer previews, `/catalog/assets` marketing library (browse, tag filter, upload), presentation builder + in-app slideshow + PDF export, `getAttachableAssets()` helper consumed by email drafting (WO-04) and the policy gate, optional `presentation-draft` assistant (stretch).

**Non-goals:** product CRUD admin (seeded catalog is the catalog; no product editing UI); asset versioning/DAM features; slide free-form design (fixed clean templates only); public share links.

## Tasks

1. **Catalog browse** (`src/app/(hub)/catalog/page.tsx`): grid of swatch cards (family, finish, SKU mono-type); filters: family, finish, fire-rating, in-stock; search over sku/name/description (Postgres `ilike`/trigram — no external search dep). Server component + searchParams; skeletons + designed empty state.
2. **Product detail** (`catalog/[sku]/page.tsx`): swatch hero, spec panel (thickness, width, fire rating, adhesive from `products.spec`), inventory chip (available, lead time via ErpProvider read), price visibility per tier (list price only — account pricing lives in quotes), documents section (task 3), "order sample" CTA (links WO-09 flow if merged, else disabled-with-tooltip), "generate room scene" CTA (WO-11, same degrade), recent activity touching this product (activities query).
3. **PDS library.** Per-product documents (`pds|install|test_report|warranty`) listed with kind badges; click → PdfViewer page-image preview (reuse WO-01 stub, complete it here if WO-06 hasn't: render page images server-side once per doc into Blob, cache on `pds_documents.pages`). A global `/catalog/documents` view (all docs, filter by kind/product) for the submittal-builder story.
4. **Marketing assets** (`catalog/assets/page.tsx`): grid over `assets` (brochure|case_study|presentation|scene|swatch) w/ tag filters + upload (Blob via `putBlob`, size/type-checked; pdf/png/jpg only), tag editor. **`src/lib/assets.ts`: `getAttachableAssets(filter?)` + `isAttachable(ref)`** — the canonical helpers the policy gate (WO-01 config) and email drafting (WO-04) consume; JSDoc as the cross-WO contract. Registering a new asset audit-logs.
5. **Presentation builder** (`catalog/presentations/`): list + `new` flow — pick products (multi-select from catalog), per-product slide auto-composed (swatch, name/sku, key specs, PDS thumbnail link, optional room-scene image if one exists for the product), plus title + closing/contact slides (rep persona). Store as `presentations.slides` jsonb (typed slide union). Reorder/remove slides; no free-form editing.
6. **Slideshow + export.** In-app slideshow route (`presentations/[id]/present`): keyboard arrows, dark, clean (03 aesthetic). Export: server action renders slides to PDF via the same PDF lib as seeds (pdf-lib; fixed layout templates), stores to Blob, registers the PDF as an `assets` row (kind `presentation`) — making it email-attachable through the standard origin check.
7. **Optional stretch — `presentation-draft` assistant** (only if all else green): `defineAgent`, `MODELS.frontier`, read-only tools (`get_opportunity_context`, `search_products`), output = proposed product list + slide order + one-line talking point per slide; human picks/edits in the builder. No external-effect tools at all.
8. **Tests:** `getAttachableAssets`/`isAttachable` contract; slide-union Zod round-trip; export action produces a PDF with N slides (page count assert); upload rejects oversized/wrong-type files.

## Files to create or modify

- `src/app/(hub)/catalog/page.tsx`, `catalog/[sku]/page.tsx`, `catalog/documents/page.tsx`, `catalog/assets/page.tsx`, `catalog/presentations/*` — create
- `src/lib/assets.ts`, `src/lib/assets.test.ts` — create (cross-WO contract)
- `src/lib/presentations.ts` (+ pdf export), `src/lib/presentations.test.ts` — create
- `src/components/pdf-viewer.tsx` — complete if still a stub (coordinate: WO-06 also completes it; whoever merges first wins, second rebases)
- `src/agents/presentation-draft.ts` — create (stretch only)

## Agent definitions

None required (optional `presentation-draft` stretch defined in task 7 — read-only tools, no approvals involved since output is only a proposal consumed in-UI).

## Data touched

Reads: `products`, `pds_documents`, `inventory`, `assets`, `presentations`, `activities`, `room_scenes`. Writes: `assets` (upload/register), `presentations`, `audit_log` (asset registration, export).

## Demo beats enabled

- Beat 5's follow-up draft attaches PDS docs — sourced from this library through `isAttachable`.
- Beat 7 (submittals) builds on the PDS library and `/catalog/documents`.
- Catalog + slideshow appear as B-roll of "the whole shebang" breadth.

## Acceptance criteria

- [ ] Catalog renders all ~60 seeded SKUs with working filters/search; product detail shows spec, stock chip, and all 4 doc kinds for hero SKU `MS-WG-1147`.
- [ ] PdfViewer previews any seeded PDS; `/catalog/documents` lists and filters all docs.
- [ ] Upload: valid PDF becomes an attachable asset (visible to `getAttachableAssets`, audit row written); oversized/wrong type rejected with a visible error.
- [ ] A presentation built from 3 products exports to a PDF with title + 3 product + closing slides (5 pages), registered as an `assets` row, and that asset passes `isAttachable`.
- [ ] `getAttachableAssets`/`isAttachable` exported with JSDoc and consumed by no other duplicate implementation (grep proves single source).
- [ ] All surfaces responsive; empty states designed; `pnpm typecheck && pnpm lint && pnpm test` green.

## Verification

1. `pnpm seed && pnpm dev` → browse catalog, filter by family, open `MS-WG-1147`, preview each doc kind.
2. Upload a small test PDF to assets; confirm audit row and attachability in `pnpm db:studio`.
3. Build + present + export a 3-product presentation; open the exported PDF; confirm asset registration.
4. `pnpm test`.

## Kickoff prompt

```
You are implementing WO-10 (Catalog / PDS Library / Presentations / Assets)
of the Clea Sales Hub.

Read, in order: docs/00-MASTER-PLAN.md, docs/01-ARCHITECTURE.md,
docs/03-DESIGN-SYSTEM.md, docs/work-orders/WO-10-catalog-presentations.md.

Work on branch <branch>. WO-01 is merged. Your `src/lib/assets.ts` helpers
are a cross-WO contract consumed by the policy gate and email drafting —
write them first and JSDoc them.

Definition of done: every Acceptance criteria checkbox verified via the
Verification steps; the asset library is the single source of attachable
files; pnpm typecheck && pnpm lint && pnpm test green.
```
