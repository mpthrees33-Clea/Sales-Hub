import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Product, Customer, Project, SampleOrder,
  EmailMessage, Brochure, Catalog,
  PriceEntry, DistributorPriceList, AppSettings,
  Rep, SalesLocation, EmailThread, EmailDraft,
  Quote, Activity, GcSubEdge, DormantDigest,
  ProjectExtensions,
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
} from '../data/seedData';

// Append-only ID lists for migration safety. When the seed expands with new
// canonical demo entities (e.g. dormant customers + projects), the migration
// uses these to merge missing IDs into existing persisted state without
// clobbering any rep-edited data.
const SEED_DORMANT_CUSTOMER_IDS = ['c13', 'c14', 'c15', 'c16', 'c17'];
const SEED_DORMANT_PROJECT_IDS = ['pr21', 'pr22', 'pr23', 'pr24', 'pr25'];

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

  // Settings
  settings: AppSettings;

  // UI
  sidebarOpen: boolean;
  selectedProjectId: string | null;
  selectedEmailId: string | null;     // current email view (used by voice routing)
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

  // Actions — UI
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedEmailId: (id: string | null) => void;

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
      settings: DEFAULT_SETTINGS,
      sidebarOpen: true,
      selectedProjectId: null,
      selectedEmailId: null,
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
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedDate: new Date().toISOString() } : p,
          ),
        })),
      deleteProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

      // Sample Orders
      addSampleOrder: (o) => set((s) => ({ sampleOrders: [...s.sampleOrders, o] })),
      updateSampleOrder: (id, patch) =>
        set((s) => ({ sampleOrders: s.sampleOrders.map((o) => o.id === id ? { ...o, ...patch } : o) })),

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

      // UI
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      setSelectedEmailId: (id) => set({ selectedEmailId: id }),

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
      version: 4,
      // Migrate persisted state across schema versions.
      //   v1 → v2: 'Quoted' → 'Bidding' status rename
      //   v2 → v3: backfill new opportunity-shaped fields on projects;
      //            seed new entity arrays (reps, locations, threads, etc.)
      //   v3 → v4: merge in the 5 dormant-only customers + projects added
      //            for the weekly dormant digest demo. Append-only — never
      //            overwrites rep-edited entries.
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
        settings: state.settings,
        currentRepId: state.currentRepId,
      }),
    }
  )
);
