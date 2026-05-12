# Sales Hub — Dev Handoff

## Branch
`claude/sales-hub-app-3L2AO`

## Repository
`mpthrees33-clea/Sales-Hub` on GitHub

---

## What This App Is

Sales Hub is a **mobile-first PWA for Trinity Surfaces flooring sales reps** (Georgia-based distributor). The active rep is **Colton Plante** (`colton@trinitysurfaces.com`). Every product Trinity sells has:
- A **Trinity name + Trinity SKU** (our internal identity)
- One or more **private-label / competitor names** (same physical product sold under Armstrong, COREtec, Shaw, Mohawk, Pergo, Mannington, etc.)

The app runs entirely in the browser with **no backend** — all state lives in Zustand persisted to `localStorage`. The store is at version 11 with a full migration chain.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS (custom design tokens in `tailwind.config.js`) |
| State | Zustand 4 + `persist` middleware (`src/store/useAppStore.ts`) |
| Router | React Router 6 |
| Icons | Lucide React |
| Voice | Web Speech API (`src/hooks/useSpeech.ts`) |

---

## All Files — What Is Done

| File | Status | Notes |
|------|--------|-------|
| `src/types/index.ts` | ✅ Complete | All domain types defined — Product, Brochure, Catalog, Presentation, PriceEntry, DistributorPriceList, Customer, Project, SampleOrder, EmailMessage, Appointment, etc. |
| `src/data/seedData.ts` | ⚠️ Placeholder data | 100KB of mock data — products/prices/brochures are INVENTED. **This is the main thing that needs replacing with real Trinity data.** |
| `src/store/useAppStore.ts` | ✅ Complete | Zustand store v11, full migration chain, all CRUD actions wired |
| `src/App.tsx` | ✅ Complete | Routes: `/`, `/brochures`, `/crm`, `/samples`, `/email`, `/pricing`, `/assistant` |
| `src/main.tsx` | ✅ Complete | |
| `src/index.css` | ✅ Complete | |
| `src/components/layout/Sidebar.tsx` | ✅ Complete | Collapses to hamburger on mobile |
| `src/components/layout/Header.tsx` | ✅ Complete | |
| `src/pages/Dashboard.tsx` | ✅ Complete | Sales targets, appointments widget (Looking Ahead), Daily Recap, dormant accounts, opportunity candidates |
| `src/pages/BrochuresPage.tsx` | ✅ Complete (UI) | 3 tabs: Brochures / Catalogs / Presentations. **Needs real brochure data** (see priorities below) |
| `src/pages/CRMPage.tsx` | ✅ Complete | Kanban + List views, detail panel, new project modal, opportunity stages |
| `src/pages/SamplesPage.tsx` | ✅ Complete | Multi-step form, product lookup by any name, contact + ship-to pickers |
| `src/pages/EmailPage.tsx` | ✅ Complete | Inbox/Drafts/Sent, compose mode, AI tools panel, auto-drafted replies |
| `src/pages/PricingPage.tsx` | ✅ Complete (UI) | 3 tabs: Price Sheet / Crossover Lookup / Distributor Lists. **Needs real price data** |
| `src/pages/AssistantPage.tsx` | ✅ Complete | Mobile-first voice/text assistant, conversation engine |
| `src/hooks/useSpeech.ts` | ✅ Complete | Web Speech API + TTS |
| `src/lib/assistant.ts` | ✅ Complete | Intent recognition + conversation flows |
| `src/lib/sampleFollowUp.ts` | ✅ Complete | Auto-draft follow-up emails after sample delivery |
| `src/components/brochures/UploadModal.tsx` | ✅ Complete | Upload PDF, stores file in localStorage as object URL |
| `src/components/brochures/CatalogModal.tsx` | ✅ Complete | Create/edit catalog, pick brochures from the library |
| `src/components/brochures/PresentationEditor.tsx` | ✅ Complete | Slide deck builder — title slides, brochure slides |
| `src/components/brochures/PresentMode.tsx` | ✅ Complete | Full-screen tap-to-advance presenter view |
| `src/components/brochures/SlideRenderer.tsx` | ✅ Complete | Renders individual slides (title, brochure, product) |
| `src/components/crm/` | ✅ Complete | Kanban board, project detail, GC↔Sub insights |
| `src/components/email/` | ✅ Complete | |
| `src/components/voice/VoiceButton.tsx` | ✅ Complete | Floating mic button on all pages except /assistant |
| `src/components/common/ErrorBoundary.tsx` | ✅ Complete | |
| `src/config/` | ✅ Complete | Pricing rules config |
| `index.html`, `vite.config.ts`, `tsconfig*.json`, `tailwind.config.js`, `postcss.config.js`, `package.json` | ✅ Complete | |

---

## ⚡ TOP PRIORITIES FOR NEXT SESSION

The UI is fully built. The gap is **real data**. Focus here:

### Priority 1 — Real Brochures in BrochuresPage

**Current state:** `src/data/seedData.ts` has ~15 brochure entries with fake names, `hasFile: false` (no actual PDFs attached). The Brochures tab shows these placeholders with no "View" button.

**What needs to happen:**
1. Replace `seedBrochures` in `seedData.ts` with **real Trinity Surfaces brochure metadata** — actual PDF names, brands, categories, page counts, tags.
2. Each `Brochure` object shape:
```ts
{
  id: string;          // e.g. 'brochure-coretec-plus'
  name: string;        // e.g. 'COREtec Plus LVP Collection'
  brand: string;       // e.g. 'COREtec'
  category: string;    // e.g. 'LVP'
  fileName: string;    // original PDF filename
  fileSize?: number;
  uploadDate: string;  // ISO date
  tags: string[];      // e.g. ['waterproof', 'commercial', 'residential']
  description?: string;
  productIds: string[];
  pageCount?: number;
  hasFile?: boolean;   // true only if PDF is actually uploaded
}
```
3. **For actual PDF delivery**: The `UploadModal` stores PDFs as object URLs in localStorage via `saveFile(brochureId, file)` / `getFile(brochureId)` pattern. For the demo, either:
   - Ask the user to upload their actual PDFs via the Upload button (existing UI works)
   - OR add a `url` field to `Brochure` type so the card's "View" button can link to a hosted/CDN URL instead of requiring an upload

**Recommended approach:** Add optional `url?: string` to `Brochure` type. In `BrochureCard`, show the View link if `fileUrl || brochure.url`. This lets real hosted PDFs work immediately without upload.

---

### Priority 2 — Real Prices in PricingPage

**Current state:** `seedPriceEntries` and `seedProducts` contain invented SKUs and made-up prices.

**What needs to happen:**
1. Replace `seedProducts` with real Trinity products (trinityName, trinitySku, category, listPrice, netPrice, privateLabels array)
2. Replace `seedPriceEntries` with real entries that reference those product IDs
3. For the **Crossover Lookup** tab — this is where the private-label mapping is most valuable. Each product's `privateLabels` array maps:
```ts
privateLabels: [
  { brand: 'COREtec', productName: 'COREtec Plus Enhanced 7" Plank', sku: 'VV012-00164', listPrice: 4.99, netPrice: 3.19 },
  { brand: 'Pergo', productName: 'Pergo Outlast+ Waterproof', sku: 'LF000814', listPrice: 4.49, netPrice: 2.99 },
]
```
4. For the **Distributor Lists** tab: `seedDistributorPriceLists` holds distributor-level pricing (Floor & Decor, etc.) with `listPrice`/`dealerPrice` per product.

**Data structure for a product:**
```ts
{
  id: 'prod-001',
  trinityName: 'Apex Oak SPC 7mm',
  trinitySku: 'TR-SPC-7001',
  category: 'SPC',
  description: '...',
  specs: { 'AC Rating': 'AC4', 'Warranty': '25 years' },
  privateLabels: [...],
  tags: ['waterproof', 'commercial'],
  brochureIds: ['brochure-xxx'],
  listPrice: 3.49,
  netPrice: 2.15,
  unit: 'sq ft',
  status: 'active',
  dimensions: { thicknessMm: 7, lengthIn: 48, widthIn: 7, wearLayerMil: 20 },
  pack: { sfPerCarton: 22.5, sfPerPallet: 900, cartonsPerPallet: 40, lbsPerCarton: 28, lbsPerPallet: 1120 },
}
```

---

### Priority 3 — Real Catalogs

**Current state:** `seedCatalogs` has 2-3 placeholder catalogs with fake brochure IDs.

**What needs to happen:**
- Replace with real catalog collections that reference real brochure IDs
- Typical catalogs: "Residential LVP Portfolio", "Commercial SPC Spec Book", "Hardwood Showcase"
- Each catalog's `brochureIds` array must match IDs that exist in `seedBrochures`

---

### Priority 4 — Real Presentations / Slide Decks

**Current state:** 3 template presentations exist (`pres-template-*`) with brochure slide references pointing to fake brochure IDs. The PresentMode (full-screen presenter) works great — it just shows empty slides because brochure IDs don't resolve.

**What needs to happen:**
- Once brochures have real IDs, update `seedPresentations` so `slides[].brochureId` values point to real brochures
- Title slides just need `title` + optional `subtitle` — these already work

---

## How to Get Real Data In

The user (owner) needs to supply the actual Trinity Surfaces product list, pricing, and brochure PDFs. When they do:

1. **Products + prices**: Edit `src/data/seedData.ts` — replace `seedProducts` and `seedPriceEntries`
2. **Brochures**: Edit `seedBrochures` with real metadata. For actual PDFs either:
   - User uploads via the UI (Upload button on Brochures tab — works today)
   - Or add `url` field to `Brochure` type (see Priority 1 above) and link hosted PDFs
3. **Store version bump**: After changing seed data, bump `version` in `useAppStore.ts` (currently `11` → `12`) and add a migration clause to merge the new seeds

---

## Key Architecture Notes

### Zustand Store Migration Pattern
Every time seed data changes in a way that existing persisted state won't have, bump the version and add a migration in the `migrate` function. The pattern is:
```ts
// vN → vN+1: description
if (!Array.isArray(persisted.newThing)) {
  persisted.newThing = seedNewThing;
}
```
For appending new records to existing arrays, always check by ID and append-only (never overwrite user-edited data).

### Brochure File Storage
`UploadModal` uses:
- `saveFile(brochureId, file)` — saves to localStorage as data URL
- `getFile(brochureId)` — retrieves it back as an object URL

Both functions are exported from `src/components/brochures/UploadModal.tsx`.

### Product Lookup
`lookupProductByAnyName(query)` in the store searches by Trinity name, SKU, private-label name, brand, SKU, tag, or category — used by the Samples page and voice assistant.

### No Backend
Everything is localStorage. No API calls, no auth. Data resets if localStorage is cleared (add a warning or export/import feature if needed).

---

## Pages — Route Map

| Route | Page | Key Features |
|---|---|---|
| `/` | Dashboard | Sales targets, appointments (Looking Ahead), Daily Recap, dormant accounts, opportunity candidates widget |
| `/brochures` | BrochuresPage | **TAB: Brochures** — library grid, search, category filter, upload PDF; **TAB: Catalogs** — manage catalog collections, clone templates; **TAB: Presentations** — build/present slide decks |
| `/crm` | CRMPage | Kanban (Lead→Active→Bidding→Won/Lost), list view, project detail panel, new project modal, GC↔Sub insights tab |
| `/samples` | SamplesPage | Multi-step sample order form, product search, contact/address pickers |
| `/email` | EmailPage | Inbox/Sent/Drafts, auto-drafted replies, compose, AI tools panel |
| `/pricing` | PricingPage | **TAB: Price Sheet** — sortable product+price table; **TAB: Crossover Lookup** — search any brand name to find Trinity equivalent; **TAB: Distributor Lists** — distributor-level pricing |
| `/assistant` | AssistantPage | Voice/text AI assistant, full-screen mobile-first |

---

## Design Tokens (Tailwind)

Colors are CSS variables defined in `src/index.css` and aliased in `tailwind.config.js`:
- `bg` — page background
- `surface` — card background
- `surface-1` — raised surface
- `fg`, `fg-muted`, `fg-faint` — text hierarchy
- `accent`, `accent-light`, `accent-dim` — Trinity teal
- `divider`, `divider-strong` — borders
- `success`, `danger`, `warning` — semantic colors

---

## Current Store Version
`version: 11` in `useAppStore.ts`. Next data migration = bump to `12`.

## Key Seed Arrays (all in `src/data/seedData.ts`)
- `seedProducts` — ~20 mock products (REPLACE with real)
- `seedBrochures` — ~15 mock brochures (REPLACE with real)
- `seedCatalogs` — ~3 mock catalogs (REPLACE with real)
- `seedPresentations` — 3 template decks (UPDATE brochureIds after real brochures land)
- `seedPriceEntries` — mock price rows (REPLACE with real)
- `seedDistributorPriceLists` — ~2 mock distributor lists (REPLACE with real)
- `seedCustomers` — demo customers (keep, expand as needed)
- `seedProjects` — ~44 demo projects (keep, expand as needed)
- `seedAppointments` — demo week for Colton (keep/update dates)
