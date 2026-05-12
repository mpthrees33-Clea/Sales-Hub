import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Product, Customer, Project, SampleOrder,
  EmailMessage, Brochure, Catalog,
  PriceEntry, DistributorPriceList, AppSettings,
  Rep, SalesLocation, EmailThread, EmailDraft,
  Quote, Activity, GcSubEdge, DormantDigest,
  ProjectExtensions, Presentation, Appointment,
  NewOpportunityCandidate,
} from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  weeklySalesTarget: 50000,
  monthlySalesTarget: 200000,
  weeklyInvoiceTarget: 50000,
  monthlyInvoiceTarget: 200000,
};
import {
  seedProducts, seedCustomers, seedProjects, seedSampleOrders,
  seedEmails, seedBrochures, seedCatalogs,
  seedPriceEntries, seedDistributorPriceLists,
  seedReps, seedSalesLocations,
  seedEmailThreads, seedEmailDrafts,
  seedActivities, seedGcSubEdges, seedDormantDigests, seedQuotes,
  seedPresentations, seedAppointments,
  CUSTOMER_ROLES_BACKFILL,
} from '../data/seedData';

// Append-only ID lists for migration safety. When the seed expands with new
// canonical demo entities (e.g. dormant customers + projects), the migration
// uses these to merge missing IDs into existing persisted state without
// clobbering any rep-edited data.
const SEED_DORMANT_CUSTOMER_IDS = ['c13', 'c14', 'c15', 'c16', 'c17'];
const SEED_DORMANT_PROJECT_IDS = ['pr21', 'pr22', 'pr23', 'pr24', 'pr25'];
// v6: dealers/subs used by the GC↔sub learning view + the historical GcSubEdge
// dataset that drives that view's first impression.
const SEED_SUB_CUSTOMER_IDS = ['c18', 'c19', 'c20'];

// Projects are stored as Project & ProjectExtensions so the new opportunity
// fields are first-class. Existing pages that consume `Project` keep working
// because every Project field is still present.
type ExtendedProject = Project & ProjectExtensions;

interface AppState {
  // Data
  products: Product[];
  customers: Customer[];
  projects: ExtendedProject[];
  sampleOrders: SampleOrder[];
  emails: EmailMessage[];
  brochures: Brochure[];
  catalogs: Catalog[];
  priceEntries: PriceEntry[];
  distributorPriceLists: DistributorPriceList[];

  // Foundation-slice entities
  reps: Rep[];
  salesLocations: SalesLocation[];
  threads: EmailThread[];
  drafts: EmailDraft[];
  activities: Activity[];
  gcSubEdges: GcSubEdge[];
  dormantDigests: DormantDigest[];
  quotes: Quote[];
  presentations: Presentation[];
  appointments: Appointment[];
  opportunityCandidates: NewOpportunityCandidate[];

  // Settings
  settings: AppSettings;

  // UI
  sidebarOpen: boolean;
  selectedProjectId: string | null;
  selectedEmailId: string | null;     // current email view (used by voice routing)
  selectedSampleOrderId: string | null; // cross-page deep link from dashboard
  currentRepId: string;               // who am I right now (dev-mode switchable)

  // Actions — Products
  addProduct: (p: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Actions — Customers
  addCustomer: (c: Customer) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Actions — Projects
  addProject: (p: ExtendedProject) => void;
  updateProject: (id: string, patch: Partial<ExtendedProject>) => void;
  deleteProject: (id: string) => void;

  // Actions — Sample Orders
  addSampleOrder: (o: SampleOrder) => void;
  updateSampleOrder: (id: string, patch: Partial<SampleOrder>) => void;

  // Actions — Emails
  addEmail: (e: EmailMessage) => void;
  updateEmail: (id: string, patch: Partial<EmailMessage>) => void;
  deleteEmail: (id: string) => void;

  // Actions — Brochures
  addBrochure: (b: Brochure) => void;
  updateBrochure: (id: string, patch: Partial<Brochure>) => void;
  deleteBrochure: (id: string) => void;

  // Actions — Catalogs
  addCatalog: (c: Catalog) => void;
  updateCatalog: (id: string, patch: Partial<Catalog>) => void;
  deleteCatalog: (id: string) => void;

  // Actions — Pricing
  addPriceEntry: (e: PriceEntry) => void;
  updatePriceEntry: (id: string, patch: Partial<PriceEntry>) => void;
  addDistributorPriceList: (dpl: DistributorPriceList) => void;

  // Actions — Settings
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Actions — Reps / Locations
  setCurrentRepId: (id: string) => void;

  // Actions — Email Threads
  addThread: (t: EmailThread) => void;
  updateThread: (id: string, patch: Partial<EmailThread>) => void;

  // Actions — Drafts (auto-generated reply scaffolds)
  addDraft: (d: EmailDraft) => void;
  updateDraft: (id: string, patch: Partial<EmailDraft>) => void;
  deleteDraft: (id: string) => void;

  // Actions — Activities
  addActivity: (a: Activity) => void;

  // Actions — GC↔Sub edges
  addGcSubEdge: (e: GcSubEdge) => void;

  // Actions — Dormant digests
  addDormantDigest: (d: DormantDigest) => void;

  // Actions — Quotes
  addQuote: (q: Quote) => void;
  updateQuote: (id: string, patch: Partial<Quote>) => void;

  // Actions — Presentations
  addPresentation: (p: Presentation) => void;
  updatePresentation: (id: string, patch: Partial<Presentation>) => void;
  deletePresentation: (id: string) => void;

  // Actions — Appointments
  addAppointment: (a: Appointment) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  // Actions — Opportunity Candidates (pending decisions about whether
  // to add an opportunity to CRM)
  addOpportunityCandidate: (c: NewOpportunityCandidate) => void;
  updateOpportunityCandidate: (id: string, patch: Partial<NewOpportunityCandidate>) => void;
  discardOpportunityCandidate: (id: string) => void;

  // Actions — UI
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedEmailId: (id: string | null) => void;
  setSelectedSampleOrderId: (id: string | null) => void;

  // Utility
  lookupProductByAnyName: (query: string) => Product | undefined;
}

// Backfill defaults for any Project lacking ProjectExtensions fields. Used by
// the v2→v3 migration so existing persisted state gets opportunity-shaped
// fields without losing user data.
function backfillProjectExtensions(p: Project & Partial<ProjectExtensions>): ExtendedProject {
  return {
    ...p,
    opportunityId: p.opportunityId ?? `OPP-LEG-${p.id.toUpperCase()}`,
    salesRepId: p.salesRepId ?? 'rep-sarah',
    salesLocationId: p.salesLocationId ?? '310',
    projectType: p.projectType ?? 'other',
    opportunityStatus:
      p.opportunityStatus ??
      (p.status === 'Won' ? 'won' : p.status === 'Lost' ? 'lost' : 'active'),
    opportunityStage:
      p.opportunityStage ??
      (p.status === 'Lead' ? 'lead_qualification'
        : p.status === 'Bidding' ? 'bidding'
        : p.status === 'Won' ? 'orders_placed'
        : p.status === 'Lost' ? 'closed'
        : 'design'),
    nextStep: p.nextStep ?? '',
    updatedDate: p.updatedDate ?? p.createdDate,
    jobLocation: p.jobLocation ?? p.address,
    bidders: p.bidders ?? [],
    lastTouchAt: p.lastTouchAt ?? `${p.createdDate}T12:00:00Z`,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial data from seed
      products: seedProducts,
      customers: seedCustomers,
      projects: seedProjects,
      sampleOrders: seedSampleOrders,
      emails: seedEmails,
      brochures: seedBrochures,
      catalogs: seedCatalogs,
      priceEntries: seedPriceEntries,
      distributorPriceLists: seedDistributorPriceLists,
      reps: seedReps,
      salesLocations: seedSalesLocations,
      threads: seedEmailThreads,
      drafts: seedEmailDrafts,
      activities: seedActivities,
      gcSubEdges: seedGcSubEdges,
      dormantDigests: seedDormantDigests,
      quotes: seedQuotes,
      presentations: seedPresentations,
      appointments: seedAppointments,
      opportunityCandidates: [],
      settings: DEFAULT_SETTINGS,
      sidebarOpen: true,
      selectedProjectId: null,
      selectedEmailId: null,
      selectedSampleOrderId: null,
      currentRepId: seedReps.find((r) => r.isCurrentUser)?.id ?? 'rep-sarah',

      // Products
      addProduct: (p) => set((s) => ({ products: [...s.products, p] })),
      updateProduct: (id, patch) =>
        set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, ...patch } : p) })),
      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      // Customers
      addCustomer: (c) => set((s) => ({ customers: [...s.customers, c] })),
      updateCustomer: (id, patch) =>
        set((s) => ({ customers: s.customers.map((c) => c.id === id ? { ...c, ...patch } : c) })),
      deleteCustomer: (id) =>
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),

      // Projects
      addProject: (p) => set((s) => ({ projects: [...s.projects, backfillProjectExtensions(p)] })),
      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== id) return p;
            const now = new Date().toISOString();
            // Patches that ONLY touch cached AI summary fields are background
            // refreshes, not meaningful "touches" — so they don't reset
            // dormancy. Any other field (stage, status, value, notes,
            // stakeholders, etc.) bumps lastTouchAt so a dormant project
            // immediately loses the dormant indicator once the rep works it.
            const cacheOnlyKeys = new Set([
              'aiSummary', 'aiSuggestedNextStep', 'aiDormancyAlert', 'aiSummaryUpdatedAt',
              'lastTouchAt', // explicit lastTouchAt updates from services pass through unchanged
            ]);
            const isCacheOnly = Object.keys(patch).every((k) => cacheOnlyKeys.has(k));
            // On a real edit, also clear the cached AI dormancy alert — the
            // project isn't dormant anymore, so the banner shouldn't claim
            // it is until a fresh AI summary regenerates.
            const clearedDormancyAlert = !isCacheOnly && p.aiDormancyAlert
              ? { aiDormancyAlert: undefined }
              : {};
            return {
              ...p,
              ...patch,
              updatedDate: now,
              lastTouchAt: isCacheOnly ? p.lastTouchAt : now,
              ...clearedDormancyAlert,
            };
          }),
        })),
      deleteProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

      // Sample Orders
      addSampleOrder: (o) => set((s) => ({ sampleOrders: [...s.sampleOrders, o] })),
      updateSampleOrder: (id, patch) =>
        set((s) => ({
          sampleOrders: s.sampleOrders.map((o) => {
            if (o.id !== id) return o;
            // Stamp deliveredAt the first time the order transitions to
            // Delivered. The sample follow-up sweep keys off this timestamp
            // to draft a next-morning follow-up email.
            const becomingDelivered =
              patch.status === 'Delivered' && o.status !== 'Delivered' && !o.deliveredAt;
            const delivStamp = becomingDelivered
              ? { deliveredAt: new Date().toISOString() }
              : {};
            return { ...o, ...patch, ...delivStamp };
          }),
        })),

      // Emails
      addEmail: (e) => set((s) => ({ emails: [...s.emails, e] })),
      updateEmail: (id, patch) =>
        set((s) => ({ emails: s.emails.map((e) => e.id === id ? { ...e, ...patch } : e) })),
      deleteEmail: (id) =>
        set((s) => ({ emails: s.emails.filter((e) => e.id !== id) })),

      // Brochures
      addBrochure: (b) => set((s) => ({ brochures: [...s.brochures, b] })),
      updateBrochure: (id, patch) =>
        set((s) => ({ brochures: s.brochures.map((b) => b.id === id ? { ...b, ...patch } : b) })),
      deleteBrochure: (id) =>
        set((s) => ({ brochures: s.brochures.filter((b) => b.id !== id) })),

      // Catalogs
      addCatalog: (c) => set((s) => ({ catalogs: [...s.catalogs, c] })),
      updateCatalog: (id, patch) =>
        set((s) => ({ catalogs: s.catalogs.map((c) => c.id === id ? { ...c, ...patch } : c) })),
      deleteCatalog: (id) =>
        set((s) => ({ catalogs: s.catalogs.filter((c) => c.id !== id) })),

      // Pricing
      addPriceEntry: (e) => set((s) => ({ priceEntries: [...s.priceEntries, e] })),
      updatePriceEntry: (id, patch) =>
        set((s) => ({ priceEntries: s.priceEntries.map((e) => e.id === id ? { ...e, ...patch } : e) })),
      addDistributorPriceList: (dpl) =>
        set((s) => ({ distributorPriceLists: [...s.distributorPriceLists, dpl] })),

      // Settings
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      // Reps / locations
      setCurrentRepId: (id) => set({ currentRepId: id }),

      // Email threads
      addThread: (t) => set((s) => ({ threads: [...s.threads, t] })),
      updateThread: (id, patch) =>
        set((s) => ({ threads: s.threads.map((t) => t.id === id ? { ...t, ...patch } : t) })),

      // Drafts
      addDraft: (d) => set((s) => ({ drafts: [...s.drafts, d] })),
      updateDraft: (id, patch) =>
        set((s) => ({
          drafts: s.drafts.map((d) =>
            d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d,
          ),
        })),
      deleteDraft: (id) =>
        set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),

      // Activities
      addActivity: (a) => set((s) => ({ activities: [...s.activities, a] })),

      // GC↔Sub edges
      addGcSubEdge: (e) => set((s) => ({ gcSubEdges: [...s.gcSubEdges, e] })),

      // Dormant digests
      addDormantDigest: (d) => set((s) => ({ dormantDigests: [...s.dormantDigests, d] })),

      // Quotes
      addQuote: (q) => set((s) => ({ quotes: [...s.quotes, q] })),
      updateQuote: (id, patch) =>
        set((s) => ({ quotes: s.quotes.map((q) => q.id === id ? { ...q, ...patch } : q) })),

      // Presentations
      addPresentation: (p) => set((s) => ({ presentations: [...s.presentations, p] })),
      updatePresentation: (id, patch) =>
        set((s) => ({
          presentations: s.presentations.map((p) =>
            p.id === id ? { ...p, ...patch, modifiedDate: new Date().toISOString().slice(0, 10) } : p,
          ),
        })),
      deletePresentation: (id) =>
        set((s) => ({ presentations: s.presentations.filter((p) => p.id !== id) })),

      // Appointments
      addAppointment: (a) => set((s) => ({ appointments: [...s.appointments, a] })),
      updateAppointment: (id, patch) =>
        set((s) => ({
          appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      deleteAppointment: (id) =>
        set((s) => ({ appointments: s.appointments.filter((a) => a.id !== id) })),

      // Opportunity candidates
      addOpportunityCandidate: (c) =>
        set((s) => ({ opportunityCandidates: [...s.opportunityCandidates, c] })),
      updateOpportunityCandidate: (id, patch) =>
        set((s) => ({
          opportunityCandidates: s.opportunityCandidates.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),
      discardOpportunityCandidate: (id) =>
        set((s) => ({
          opportunityCandidates: s.opportunityCandidates.map((c) =>
            c.id === id ? { ...c, status: 'discarded' as const } : c,
          ),
        })),

      // UI
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      setSelectedEmailId: (id) => set({ selectedEmailId: id }),
      setSelectedSampleOrderId: (id) => set({ selectedSampleOrderId: id }),

      // Lookup a product by Trinity name, SKU, any private-label name/brand/SKU, tag, or category
      lookupProductByAnyName: (query) => {
        const q = query.toLowerCase().trim();
        return get().products.find((p) => {
          if (p.trinityName.toLowerCase().includes(q)) return true;
          if (p.trinitySku.toLowerCase().includes(q)) return true;
          if (p.category.toLowerCase().includes(q)) return true;
          if (p.tags.some((t) => t.toLowerCase().includes(q))) return true;
          return p.privateLabels.some(
            (pl) =>
              pl.brand.toLowerCase().includes(q) ||
              pl.productName.toLowerCase().includes(q) ||
              pl.sku.toLowerCase().includes(q)
          );
        });
      },
    }),
    {
      name: 'sales-hub-store',
      version: 11,
      // Migrate persisted state across schema versions.
      //   v1 → v2: 'Quoted' → 'Bidding' status rename
      //   v2 → v3: backfill new opportunity-shaped fields on projects;
      //            seed new entity arrays (reps, locations, threads, etc.)
      //   v3 → v4: merge in the 5 dormant-only customers + projects added
      //            for the weekly dormant digest demo. Append-only — never
      //            overwrites rep-edited entries.
      //   v4 → v5: rep identity swap — Sarah Thompson → Colton Plante.
      //            Rewrites rep display fields + every email's from/fromName
      //            so the user's persisted demo state reflects the new
      //            identity instead of showing stale Sarah signatures.
      //   v5 → v6: merge in dealer/sub customers (c18–c20) + the historical
      //            GcSubEdge dataset that drives the new CRM Insights view.
      //            Append-only.
      //   v6 → v7: backfill Customer.roles from CUSTOMER_ROLES_BACKFILL so
      //            stakeholder pickers filter correctly. Append the round
      //            of new projects (pr26+) that fill out the "2+ projects
      //            per customer" coverage. Append-only on both.
      //   v7 → v8: add Presentation store + seed three starter template
      //            decks (LVP architect pitch / hardwood designer pitch /
      //            healthcare contractor spec). Append-only on existing
      //            presentations array.
      //   v8 → v9: add Appointment store + seed the demo week for Colton
      //            (yesterday + today + 5 days ahead including a Wed
      //            lunch & learn at Greer Architecture with food pending).
      //            Append-only.
      //   v9 → v10: extra seed projects with May 2026 closing/invoiced
      //            dates so the Dashboard's Sales Created + Invoiced
      //            cards show plausible activity (pr39–pr44). The v6→v7
      //            project-append loop below picks them up automatically.
      //            Also strips product slides from built-in template
      //            presentations (per user feedback: presentations should
      //            only reference brochures). User-created decks untouched.
      //   v10 → v11: SampleOrder gains contactId / shipToAddressId /
      //            deliveredAt / followUpDraftEmailId fields. Optional —
      //            no rewrite needed for persisted state. The follow-up
      //            sweep on App mount will tolerate missing fields.
      migrate: (persisted: any, _version) => {
        if (!persisted) return persisted;

        // v1 → v2 fixup (idempotent — safe to re-run)
        if (Array.isArray(persisted.projects)) {
          persisted.projects = persisted.projects.map((p: any) =>
            p?.status === 'Quoted' ? { ...p, status: 'Bidding' } : p,
          );
        }

        // v2 → v3: backfill ProjectExtensions
        if (Array.isArray(persisted.projects)) {
          persisted.projects = persisted.projects.map(backfillProjectExtensions);
        }

        // v2 → v3: seed new entity arrays if missing
        if (!persisted.reps) persisted.reps = seedReps;
        if (!persisted.salesLocations) persisted.salesLocations = seedSalesLocations;
        if (!persisted.threads) persisted.threads = seedEmailThreads;
        if (!persisted.drafts) persisted.drafts = seedEmailDrafts;
        if (!persisted.activities) persisted.activities = seedActivities;
        if (!persisted.gcSubEdges) persisted.gcSubEdges = seedGcSubEdges;
        if (!persisted.dormantDigests) persisted.dormantDigests = seedDormantDigests;
        if (!persisted.quotes) persisted.quotes = seedQuotes;
        if (!persisted.currentRepId) {
          persisted.currentRepId = seedReps.find((r) => r.isCurrentUser)?.id ?? 'rep-sarah';
        }

        if (!persisted.settings) persisted.settings = DEFAULT_SETTINGS;

        // v3 → v4: merge dormant demo customers + projects if not already
        // present. Append-only; rep-edited data stays intact.
        if (Array.isArray(persisted.customers)) {
          const existing = new Set(persisted.customers.map((c: any) => c?.id));
          for (const id of SEED_DORMANT_CUSTOMER_IDS) {
            const seedRecord = seedCustomers.find((c) => c.id === id);
            if (seedRecord && !existing.has(id)) persisted.customers.push(seedRecord);
          }
        }
        if (Array.isArray(persisted.projects)) {
          const existing = new Set(persisted.projects.map((p: any) => p?.id));
          for (const id of SEED_DORMANT_PROJECT_IDS) {
            const seedRecord = seedProjects.find((p) => p.id === id);
            if (seedRecord && !existing.has(id)) persisted.projects.push(seedRecord);
          }
        }

        // v4 → v5: Sarah → Colton rep rename. Rewrite rep display fields,
        // every email's from/fromName, and any 'Sarah T.' note authors so
        // existing persisted demo state reflects the new identity.
        if (Array.isArray(persisted.reps)) {
          persisted.reps = persisted.reps.map((r: any) =>
            r?.id === 'rep-sarah'
              ? {
                  ...r,
                  name: 'Colton Plante',
                  initials: 'CP',
                  email: 'colton@trinitysurfaces.com',
                }
              : r,
          );
        }
        if (Array.isArray(persisted.emails)) {
          persisted.emails = persisted.emails.map((e: any) => {
            if (!e) return e;
            const out = { ...e };
            if (out.from === 'sarah@trinitysurfaces.com') {
              out.from = 'colton@trinitysurfaces.com';
            }
            if (Array.isArray(out.to)) {
              out.to = out.to.map((t: string) =>
                t === 'sarah@trinitysurfaces.com' ? 'colton@trinitysurfaces.com' : t,
              );
            }
            if (out.fromName === 'Sarah T.') out.fromName = 'Colton P.';
            return out;
          });
        }
        if (Array.isArray(persisted.projects)) {
          persisted.projects = persisted.projects.map((p: any) => {
            if (!p || !Array.isArray(p.notes)) return p;
            return {
              ...p,
              notes: p.notes.map((n: any) =>
                n?.author === 'Sarah T.' ? { ...n, author: 'Colton P.' } : n,
              ),
            };
          });
        }

        // v5 → v6: merge in dealer/sub customers + seeded gcSubEdges so the
        // new CRM Insights view has data on first visit. Append-only.
        if (Array.isArray(persisted.customers)) {
          const existing = new Set(persisted.customers.map((c: any) => c?.id));
          for (const id of SEED_SUB_CUSTOMER_IDS) {
            const seedRecord = seedCustomers.find((c) => c.id === id);
            if (seedRecord && !existing.has(id)) persisted.customers.push(seedRecord);
          }
        }
        if (Array.isArray(persisted.gcSubEdges)) {
          const existing = new Set(persisted.gcSubEdges.map((e: any) => e?.id));
          for (const edge of seedGcSubEdges) {
            if (!existing.has(edge.id)) persisted.gcSubEdges.push(edge);
          }
        } else {
          persisted.gcSubEdges = [...seedGcSubEdges];
        }

        // v6 → v7: backfill Customer.roles from the seed map so stakeholder
        // pickers filter candidates correctly even on persisted state that
        // pre-dates the roles field. Skip customers that already have a
        // non-empty roles array (rep may have edited).
        if (Array.isArray(persisted.customers)) {
          persisted.customers = persisted.customers.map((c: any) => {
            if (!c) return c;
            if (Array.isArray(c.roles) && c.roles.length > 0) return c;
            const seedRoles = CUSTOMER_ROLES_BACKFILL[c.id];
            return seedRoles ? { ...c, roles: seedRoles } : c;
          });
        }

        // v6 → v7: append the new projects added to fill out "2+ per customer"
        // (pr26 onward). Append-only on existing ids.
        if (Array.isArray(persisted.projects)) {
          const existing = new Set(persisted.projects.map((p: any) => p?.id));
          for (const project of seedProjects) {
            if (!existing.has(project.id)) persisted.projects.push(project);
          }
        }

        // v7 → v8: seed presentations array if missing, otherwise merge in
        // the starter templates the user hasn't already cloned/deleted.
        if (!Array.isArray(persisted.presentations)) {
          persisted.presentations = [...seedPresentations];
        } else {
          const existing = new Set(persisted.presentations.map((p: any) => p?.id));
          for (const pres of seedPresentations) {
            if (!existing.has(pres.id)) persisted.presentations.push(pres);
          }
        }

        // v8 → v9: seed appointments — drive Dashboard's Looking Ahead.
        if (!Array.isArray(persisted.appointments)) {
          persisted.appointments = [...seedAppointments];
        } else {
          const existing = new Set(persisted.appointments.map((a: any) => a?.id));
          for (const apt of seedAppointments) {
            if (!existing.has(apt.id)) persisted.appointments.push(apt);
          }
        }

        // v9 → v10: strip product slides from built-in template
        // presentations only (id starts with 'pres-template-'). User-
        // created decks may still contain product slides — they keep
        // working since the SlideRenderer's product branch is intact;
        // only the editor's "add slide" menu hides the option for new.
        if (Array.isArray(persisted.presentations)) {
          persisted.presentations = persisted.presentations.map((p: any) => {
            if (!p?.id || typeof p.id !== 'string' || !p.id.startsWith('pres-template-')) return p;
            if (!Array.isArray(p.slides)) return p;
            return {
              ...p,
              slides: p.slides.filter((s: any) => s?.type !== 'product'),
            };
          });
        }

        // v9 → v10: also initialize the opportunityCandidates array if it
        // doesn't exist yet. Empty by default — populated when the rep
        // tags a sample order as "future opportunity".
        if (!Array.isArray(persisted.opportunityCandidates)) {
          persisted.opportunityCandidates = [];
        }

        // v10 → v11: backfill deliveredAt for any pre-existing Delivered
        // sample orders so the new sample-follow-up rule can generate a
        // draft for them on first load. Backdate to yesterday at 5pm UTC
        // — past the 12h threshold the sweep checks for. Idempotent:
        // only fills it in if missing.
        if (Array.isArray(persisted.sampleOrders)) {
          const yesterday5pm = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
          persisted.sampleOrders = persisted.sampleOrders.map((o: any) => {
            if (!o || typeof o !== 'object') return o;
            if (o.status === 'Delivered' && !o.deliveredAt) {
              return { ...o, deliveredAt: yesterday5pm };
            }
            return o;
          });
        }

        return persisted;
      },
      // Don't persist file objects (objectURLs) — only metadata persists
      partialize: (state) => ({
        products: state.products,
        customers: state.customers,
        projects: state.projects,
        sampleOrders: state.sampleOrders,
        emails: state.emails,
        brochures: state.brochures,
        catalogs: state.catalogs,
        priceEntries: state.priceEntries,
        distributorPriceLists: state.distributorPriceLists,
        reps: state.reps,
        salesLocations: state.salesLocations,
        threads: state.threads,
        drafts: state.drafts,
        activities: state.activities,
        gcSubEdges: state.gcSubEdges,
        dormantDigests: state.dormantDigests,
        quotes: state.quotes,
        presentations: state.presentations,
        appointments: state.appointments,
        opportunityCandidates: state.opportunityCandidates,
        settings: state.settings,
        currentRepId: state.currentRepId,
      }),
    }
  )
);
