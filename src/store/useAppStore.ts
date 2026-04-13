import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Product, Customer, Project, SampleOrder,
  EmailMessage, Brochure, Catalog,
  PriceEntry, DistributorPriceList,
} from '../types';
import {
  seedProducts, seedCustomers, seedProjects, seedSampleOrders,
  seedEmails, seedBrochures, seedCatalogs,
  seedPriceEntries, seedDistributorPriceLists,
} from '../data/seedData';

interface AppState {
  // Data
  products: Product[];
  customers: Customer[];
  projects: Project[];
  sampleOrders: SampleOrder[];
  emails: EmailMessage[];
  brochures: Brochure[];
  catalogs: Catalog[];
  priceEntries: PriceEntry[];
  distributorPriceLists: DistributorPriceList[];

  // UI
  sidebarOpen: boolean;

  // Actions — Products
  addProduct: (p: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Actions — Customers
  addCustomer: (c: Customer) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Actions — Projects
  addProject: (p: Project) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
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

  // Actions — UI
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Utility
  lookupProductByAnyName: (query: string) => Product | undefined;
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
      sidebarOpen: true,

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
      addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, ...patch } : p) })),
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

      // UI
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

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
      }),
    }
  )
);
