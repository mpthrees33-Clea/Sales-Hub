import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { Product } from '../types';

const BRAND_COLORS: Record<string, string> = {
  Armstrong:  'bg-danger/15 text-danger',
  COREtec:    'bg-accent/15 text-accent-light',
  Shaw:       'bg-success/15 text-success',
  Mohawk:     'bg-accent/20 text-accent-light',
  Pergo:      'bg-warning/15 text-warning',
  Mannington: 'bg-accent/10 text-accent-light',
  Daltile:    'bg-surface-1 text-fg-muted',
  Bruce:      'bg-warning/20 text-warning',
  MSI:        'bg-accent/15 text-accent-light',
  Karndean:   'bg-success/20 text-success',
};
const brandColor = (b: string) => BRAND_COLORS[b] ?? 'bg-surface-1 text-fg-muted';

// Render a small spec block from a product if it has any pack/container/dim data.
// Returns null if the product has no extended specs yet.
function ProductSpecBlock({ product }: { product?: Product }) {
  if (!product) return null;
  const { pack, container, dimensions, lot, shade } = product;
  const hasAny =
    !!pack || !!container || !!dimensions || !!lot || !!shade;
  if (!hasAny) return null;

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) =>
    value === undefined || value === null || value === '' ? null : (
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-fg-faint">{label}</span>
        <span className="text-fg tabular-nums">{value}</span>
      </div>
    );

  // Only show container block for categories that ship by container
  const showContainer = !!container && (
    product.category === 'LVP' || product.category === 'SPC' || product.category === 'Tile'
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 mt-2 px-3 py-2 bg-bg rounded border border-divider">
      <div>
        <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wide mb-1">Dimensions</p>
        <Row label="Thickness" value={dimensions?.thicknessMm != null ? `${dimensions.thicknessMm} mm` : undefined} />
        <Row label="Size" value={
          dimensions?.lengthIn && dimensions?.widthIn
            ? `${dimensions.lengthIn}" × ${dimensions.widthIn}"`
            : undefined
        } />
        <Row label="Wear layer" value={dimensions?.wearLayerMil != null ? `${dimensions.wearLayerMil} mil` : undefined} />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wide mb-1">Pack</p>
        <Row label="sf/ctn" value={pack?.sfPerCarton} />
        <Row label="sf/plt" value={pack?.sfPerPallet} />
        <Row label="ctn/plt" value={pack?.cartonsPerPallet} />
        <Row label="lbs/ctn" value={pack?.lbsPerCarton} />
        <Row label="lbs/plt" value={pack?.lbsPerPallet} />
        <Row label="pcs/ctn" value={pack?.piecesPerCarton} />
      </div>
      <div>
        {showContainer && (
          <>
            <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wide mb-1">Container</p>
            <Row label="ctn/cont" value={container?.cartonsPerContainer} />
            <Row label="sf/cont" value={container?.sfPerContainer} />
            <Row label="plt/cont" value={container?.palletsPerContainer} />
          </>
        )}
        {(lot || shade) && (
          <>
            <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wide mb-1 mt-2">Quality</p>
            <Row label="Lot" value={lot} />
            <Row label="Shade" value={shade} />
          </>
        )}
      </div>
    </div>
  );
}

type SortField = 'name' | 'sku' | 'list' | 'net' | 'margin' | 'thickness' | 'unit';
type SortDir = 'asc' | 'desc';

// ── Price Sheet Tab ────────────────────────────────────────
function PriceSheetTab() {
  const { priceEntries, products } = useAppStore();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  const grouped = priceEntries.reduce<Record<string, typeof priceEntries>>((acc, e) => {
    (acc[e.productId] ??= []).push(e);
    return acc;
  }, {});

  const productById = new Map(products.map((p) => [p.id, p]));

  const productIds = Object.keys(grouped).filter((pid) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return grouped[pid].some((e) =>
      e.trinityName.toLowerCase().includes(q) || e.trinitySku.toLowerCase().includes(q) ||
      e.privateLabelBrand.toLowerCase().includes(q) || e.privateLabelName.toLowerCase().includes(q)
    );
  });

  // Sort
  const sorted = [...productIds].sort((a, b) => {
    const ea = grouped[a][0], eb = grouped[b][0];
    const pa = productById.get(a), pb = productById.get(b);
    let av: string | number | undefined;
    let bv: string | number | undefined;
    switch (sortField) {
      case 'name': av = ea.trinityName.toLowerCase(); bv = eb.trinityName.toLowerCase(); break;
      case 'sku':  av = ea.trinitySku.toLowerCase();  bv = eb.trinitySku.toLowerCase();  break;
      case 'list': av = ea.listPrice; bv = eb.listPrice; break;
      case 'net':  av = ea.netPrice;  bv = eb.netPrice;  break;
      case 'margin':
        av = (ea.listPrice - ea.netPrice) / ea.listPrice;
        bv = (eb.listPrice - eb.netPrice) / eb.listPrice;
        break;
      case 'thickness':
        av = pa?.dimensions?.thicknessMm; bv = pb?.dimensions?.thicknessMm; break;
      case 'unit': av = ea.unit; bv = eb.unit; break;
    }
    // null / undefined sort to the end
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHead = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
    <th className={`px-3 py-2 text-${align} cursor-pointer select-none hover:text-fg`} onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </span>
    </th>
  );

  return (
    <>
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-2.5 text-fg-faint" />
        <input className="w-full pl-8 pr-3 py-2 text-sm border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Search name, SKU, brand…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-divider">
        <table className="w-full text-sm">
          <thead className="bg-bg text-xs text-fg-muted uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left w-6" />
              <SortHead field="name" label="Trinity Name" />
              <SortHead field="sku" label="SKU" />
              <SortHead field="list" label="List $" align="right" />
              <SortHead field="net" label="Net $" align="right" />
              <SortHead field="margin" label="Margin" align="right" />
              <SortHead field="thickness" label="Thk" align="right" />
              <SortHead field="unit" label="Unit" />
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {sorted.map((pid) => {
              const entries = grouped[pid];
              const first = entries[0];
              const isOpen = expanded === pid;
              const margin = ((first.listPrice - first.netPrice) / first.listPrice * 100).toFixed(0);
              const product = productById.get(pid);
              const thk = product?.dimensions?.thicknessMm;
              return [
                <tr key={pid} className="hover:bg-bg cursor-pointer" onClick={() => setExpanded(isOpen ? null : pid)}>
                  <td className="px-3 py-2 text-fg-faint"><ChevronDown size={13} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} /></td>
                  <td className="px-3 py-2 font-medium text-fg">{first.trinityName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-fg-muted">{first.trinitySku}</td>
                  <td className="px-3 py-2 text-right text-fg">${first.listPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-success font-medium">${first.netPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-fg-muted">{margin}%</td>
                  <td className="px-3 py-2 text-right text-fg-muted text-xs">{thk != null ? `${thk}mm` : '—'}</td>
                  <td className="px-3 py-2 text-fg-faint text-xs">{first.unit}</td>
                </tr>,
                isOpen && (
                  <tr key={`${pid}-spec`} className="bg-surface-1">
                    <td />
                    <td colSpan={7} className="px-3 pt-1 pb-2">
                      <ProductSpecBlock product={product} />
                    </td>
                  </tr>
                ),
                isOpen && entries.map((e) => (
                  <tr key={e.id} className="bg-accent/10">
                    <td className="px-3 py-1.5" />
                    <td colSpan={2} className="px-3 py-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-2 ${brandColor(e.privateLabelBrand)}`}>{e.privateLabelBrand}</span>
                      <span className="text-xs text-fg">{e.privateLabelName}</span>
                      <span className="text-xs text-fg-faint ml-2 font-mono">{e.privateLabelSku}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs text-fg-muted">${e.listPrice.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-xs text-success">${e.netPrice.toFixed(2)}</td>
                    <td colSpan={3} />
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
  const { products, deleteProduct, priceEntries, updatePriceEntry } = useAppStore();
  const [query, setQuery] = useState('');

  function handleDelete(p: Product) {
    const linked = priceEntries.filter((e) => e.productId === p.id).length;
    const msg = linked > 0
      ? `Delete "${p.trinityName}"? ${linked} price entr${linked === 1 ? 'y references' : 'ies reference'} this product and will be unlinked.`
      : `Delete "${p.trinityName}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    // Unlink price entries (keep the row, drop the productId)
    priceEntries
      .filter((e) => e.productId === p.id)
      .forEach((e) => updatePriceEntry(e.id, { productId: '' }));
    deleteProduct(p.id);
  }

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
        <Search size={16} className="absolute left-3 top-3 text-fg-faint" />
        <input
          className="w-full pl-10 pr-3 py-3 text-sm border border-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-accent shadow-none"
          placeholder="Search any product name, brand name, or SKU…"
          value={query} onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.length < 2 && (
        <p className="text-center text-fg-faint text-sm py-12">Type any name — ours or theirs — to find the match</p>
      )}

      <div className="space-y-3">
        {results.map((p) => (
          <div key={p.id} className="bg-surface rounded-lg border border-divider p-4 relative">
            <button
              onClick={() => handleDelete(p)}
              className="absolute top-3 right-3 p-1.5 rounded text-fg-faint hover:text-danger hover:bg-danger/10 transition-colors"
              aria-label={`Delete ${p.trinityName}`}
              title="Delete product"
            >
              <Trash2 size={14} />
            </button>
            <div className="flex flex-col sm:flex-row gap-4 pr-8">
              {/* Trinity side */}
              <div className="sm:w-48 shrink-0">
                <p className="text-xs font-semibold text-accent-light uppercase tracking-wide mb-1">Trinity</p>
                <p className="font-semibold text-fg">{p.trinityName}</p>
                <p className="text-xs font-mono text-fg-muted">{p.trinitySku}</p>
                <p className="text-xs text-fg-muted mt-1">{p.category}</p>
                <p className="text-sm font-bold text-fg mt-1">${p.listPrice}/{p.unit}</p>
                <p className="text-xs text-success">Net: ${p.netPrice}</p>
              </div>
              {/* Private labels */}
              <div className="flex-1 overflow-x-auto">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-1">Known As</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-fg-faint border-b border-divider">
                      <th className="text-left pb-1">Brand</th>
                      <th className="text-left pb-1">Product Name</th>
                      <th className="text-left pb-1 font-mono">SKU</th>
                      <th className="text-right pb-1">List</th>
                      <th className="text-right pb-1">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {p.privateLabels.map((pl, i) => (
                      <tr key={i} className="hover:bg-bg">
                        <td className="py-1.5 pr-2">
                          <span className={`px-1.5 py-0.5 rounded font-medium text-xs ${brandColor(pl.brand)}`}>{pl.brand}</span>
                        </td>
                        <td className="py-1.5 pr-2 text-fg">{pl.productName}</td>
                        <td className="py-1.5 pr-2 font-mono text-fg-faint">{pl.sku}</td>
                        <td className="py-1.5 text-right text-fg-muted">${pl.listPrice?.toFixed(2) ?? '—'}</td>
                        <td className="py-1.5 text-right text-success">${pl.netPrice?.toFixed(2) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <ProductSpecBlock product={p} />
          </div>
        ))}
        {query.length >= 2 && results.length === 0 && (
          <p className="text-center text-fg-faint text-sm py-8">No products matched "{query}"</p>
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
          <div key={dpl.id} className="bg-surface rounded-lg border border-divider overflow-hidden">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg"
              onClick={() => setOpen(isOpen ? null : dpl.id)}>
              <div>
                <p className="font-semibold text-fg">{dpl.distributorName}</p>
                <p className="text-xs text-fg-faint">Effective: {dpl.effectiveDate} · {dpl.entries.length} items</p>
              </div>
              <ChevronDown size={16} className={`text-fg-faint transition-transform ${isOpen ? '' : '-rotate-90'}`} />
            </button>
            {isOpen && (
              <div className="border-t border-divider">
                <div className="px-4 py-2">
                  <input className="w-full text-xs border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Filter entries…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-bg text-xs text-fg-muted uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Product</th>
                      <th className="px-4 py-2 text-left">SKU</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-right">List</th>
                      <th className="px-4 py-2 text-right">Dealer</th>
                      <th className="px-4 py-2 text-left">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {filtered.map((e) => (
                      <tr key={e.id} className="hover:bg-bg">
                        <td className="px-4 py-2 text-fg">{e.productName}</td>
                        <td className="px-4 py-2 font-mono text-xs text-fg-muted">{e.sku}</td>
                        <td className="px-4 py-2 text-fg-muted">{e.category}</td>
                        <td className="px-4 py-2 text-right text-fg-muted">${e.listPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-success font-medium">${e.dealerPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-fg-faint text-xs">{e.unit}</td>
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
      <div className="flex gap-2 border-b border-divider">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-light' : 'border-transparent text-fg-muted hover:text-fg'}`}>
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
