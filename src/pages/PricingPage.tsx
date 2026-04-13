import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, ChevronDown } from 'lucide-react';

const BRAND_COLORS: Record<string, string> = {
  Armstrong: 'bg-red-100 text-red-700', COREtec: 'bg-blue-100 text-blue-700',
  Shaw: 'bg-green-100 text-green-700', Mohawk: 'bg-purple-100 text-purple-700',
  Pergo: 'bg-orange-100 text-orange-700', Mannington: 'bg-teal-100 text-teal-700',
  Daltile: 'bg-slate-100 text-slate-600', Bruce: 'bg-amber-100 text-amber-700',
  MSI: 'bg-cyan-100 text-cyan-700', Karndean: 'bg-pink-100 text-pink-700',
};
const brandColor = (b: string) => BRAND_COLORS[b] ?? 'bg-slate-100 text-slate-600';

// ── Price Sheet Tab ────────────────────────────────────────
function PriceSheetTab() {
  const { priceEntries } = useAppStore();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = priceEntries.reduce<Record<string, typeof priceEntries>>((acc, e) => {
    (acc[e.productId] ??= []).push(e);
    return acc;
  }, {});

  const productIds = Object.keys(grouped).filter((pid) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return grouped[pid].some((e) =>
      e.trinityName.toLowerCase().includes(q) || e.trinitySku.toLowerCase().includes(q) ||
      e.privateLabelBrand.toLowerCase().includes(q) || e.privateLabelName.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
        <input className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search name, SKU, brand…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left w-6" />
              <th className="px-3 py-2 text-left">Trinity Name</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">List $</th>
              <th className="px-3 py-2 text-right">Net $</th>
              <th className="px-3 py-2 text-right">Margin</th>
              <th className="px-3 py-2 text-left">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productIds.map((pid) => {
              const entries = grouped[pid];
              const first = entries[0];
              const isOpen = expanded === pid;
              const margin = ((first.listPrice - first.netPrice) / first.listPrice * 100).toFixed(0);
              return [
                <tr key={pid} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(isOpen ? null : pid)}>
                  <td className="px-3 py-2 text-slate-400"><ChevronDown size={13} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} /></td>
                  <td className="px-3 py-2 font-medium text-slate-800">{first.trinityName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{first.trinitySku}</td>
                  <td className="px-3 py-2 text-right text-slate-700">${first.listPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-green-700 font-medium">${first.netPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{margin}%</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{first.unit}</td>
                </tr>,
                isOpen && entries.map((e) => (
                  <tr key={e.id} className="bg-blue-50">
                    <td className="px-3 py-1.5" />
                    <td colSpan={2} className="px-3 py-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-2 ${brandColor(e.privateLabelBrand)}`}>{e.privateLabelBrand}</span>
                      <span className="text-xs text-slate-700">{e.privateLabelName}</span>
                      <span className="text-xs text-slate-400 ml-2 font-mono">{e.privateLabelSku}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs text-slate-600">${e.listPrice.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-xs text-green-700">${e.netPrice.toFixed(2)}</td>
                    <td colSpan={2} />
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Crossover Lookup Tab ───────────────────────────────────
function CrossoverTab() {
  const { products } = useAppStore();
  const [query, setQuery] = useState('');

  const results = query.length >= 2 ? products.filter((p) => {
    const q = query.toLowerCase();
    return p.trinityName.toLowerCase().includes(q) || p.trinitySku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q)) ||
      p.privateLabels.some((pl) =>
        pl.brand.toLowerCase().includes(q) || pl.productName.toLowerCase().includes(q) || pl.sku.toLowerCase().includes(q)
      );
  }) : [];

  return (
    <>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input
          className="w-full pl-10 pr-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          placeholder="Search any product name, brand name, or SKU…"
          value={query} onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.length < 2 && (
        <p className="text-center text-slate-400 text-sm py-12">Type any name — ours or theirs — to find the match</p>
      )}

      <div className="space-y-3">
        {results.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Trinity side */}
              <div className="sm:w-48 shrink-0">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Trinity</p>
                <p className="font-semibold text-slate-800">{p.trinityName}</p>
                <p className="text-xs font-mono text-slate-500">{p.trinitySku}</p>
                <p className="text-xs text-slate-500 mt-1">{p.category}</p>
                <p className="text-sm font-bold text-slate-700 mt-1">${p.listPrice}/{p.unit}</p>
                <p className="text-xs text-green-600">Net: ${p.netPrice}</p>
              </div>
              {/* Private labels */}
              <div className="flex-1 overflow-x-auto">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Known As</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left pb-1">Brand</th>
                      <th className="text-left pb-1">Product Name</th>
                      <th className="text-left pb-1 font-mono">SKU</th>
                      <th className="text-right pb-1">List</th>
                      <th className="text-right pb-1">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {p.privateLabels.map((pl, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-1.5 pr-2">
                          <span className={`px-1.5 py-0.5 rounded font-medium text-xs ${brandColor(pl.brand)}`}>{pl.brand}</span>
                        </td>
                        <td className="py-1.5 pr-2 text-slate-700">{pl.productName}</td>
                        <td className="py-1.5 pr-2 font-mono text-slate-400">{pl.sku}</td>
                        <td className="py-1.5 text-right text-slate-600">${pl.listPrice?.toFixed(2) ?? '—'}</td>
                        <td className="py-1.5 text-right text-green-600">${pl.netPrice?.toFixed(2) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
        {query.length >= 2 && results.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No products matched "{query}"</p>
        )}
      </div>
    </>
  );
}

// ── Distributor Lists Tab ──────────────────────────────────
function DistributorTab() {
  const { distributorPriceLists } = useAppStore();
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-3">
      {distributorPriceLists.map((dpl) => {
        const isOpen = open === dpl.id;
        const filtered = dpl.entries.filter((e) => {
          const q = search.toLowerCase();
          return !q || e.productName.toLowerCase().includes(q) || e.sku.toLowerCase().includes(q);
        });
        return (
          <div key={dpl.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              onClick={() => setOpen(isOpen ? null : dpl.id)}>
              <div>
                <p className="font-semibold text-slate-700">{dpl.distributorName}</p>
                <p className="text-xs text-slate-400">Effective: {dpl.effectiveDate} · {dpl.entries.length} items</p>
              </div>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
            </button>
            {isOpen && (
              <div className="border-t border-slate-100">
                <div className="px-4 py-2">
                  <input className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Filter entries…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Product</th>
                      <th className="px-4 py-2 text-left">SKU</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-right">List</th>
                      <th className="px-4 py-2 text-right">Dealer</th>
                      <th className="px-4 py-2 text-left">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700">{e.productName}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-500">{e.sku}</td>
                        <td className="px-4 py-2 text-slate-500">{e.category}</td>
                        <td className="px-4 py-2 text-right text-slate-600">${e.listPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-green-700 font-medium">${e.dealerPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-slate-400 text-xs">{e.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────
export default function PricingPage() {
  const { priceEntries, distributorPriceLists } = useAppStore();
  const [tab, setTab] = useState<'sheet' | 'crossover' | 'distributor'>('sheet');

  const TABS = [
    { key: 'sheet' as const, label: `Price Sheet (${priceEntries.length})` },
    { key: 'crossover' as const, label: 'Crossover Lookup' },
    { key: 'distributor' as const, label: `Distributor Lists (${distributorPriceLists.length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'sheet'       && <PriceSheetTab />}
      {tab === 'crossover'   && <CrossoverTab />}
      {tab === 'distributor' && <DistributorTab />}
    </div>
  );
}
