import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search } from 'lucide-react';

export default function PricingPage() {
  const { priceEntries, distributorPriceLists, products } = useAppStore();
  const [tab, setTab] = useState<'trinity' | 'distributor'>('trinity');
  const [search, setSearch] = useState('');

  const filteredEntries = priceEntries.filter((e) => {
    const q = search.toLowerCase();
    return !q ||
      e.trinityName.toLowerCase().includes(q) ||
      e.trinitySku.toLowerCase().includes(q) ||
      e.privateLabelBrand.toLowerCase().includes(q) ||
      e.privateLabelName.toLowerCase().includes(q) ||
      e.privateLabelSku.toLowerCase().includes(q);
  });

  const margin = (list: number, net: number) =>
    list > 0 ? `${(((list - net) / list) * 100).toFixed(0)}%` : '—';

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'trinity' as const, label: `Trinity Prices (${priceEntries.length})` },
          { key: 'distributor' as const, label: `Distributor Lists (${distributorPriceLists.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'trinity' && (
        <>
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by Trinity name, SKU, brand, or private-label name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Trinity Name</th>
                  <th className="px-3 py-2 text-left">Trinity SKU</th>
                  <th className="px-3 py-2 text-left">Brand</th>
                  <th className="px-3 py-2 text-left">Private Label Name</th>
                  <th className="px-3 py-2 text-left">PL SKU</th>
                  <th className="px-3 py-2 text-right">List</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{e.trinityName}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs">{e.trinitySku}</td>
                    <td className="px-3 py-2 text-slate-600">{e.privateLabelBrand}</td>
                    <td className="px-3 py-2 text-slate-600">{e.privateLabelName}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs">{e.privateLabelSku}</td>
                    <td className="px-3 py-2 text-right text-slate-700">${e.listPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-medium">${e.netPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{margin(e.listPrice, e.netPrice)}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{e.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'distributor' && (
        <div className="space-y-4">
          {distributorPriceLists.map((dpl) => (
            <div key={dpl.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-700">{dpl.distributorName}</p>
                  <p className="text-xs text-slate-400">Effective: {dpl.effectiveDate} · Uploaded: {dpl.uploadDate}</p>
                </div>
                <span className="text-xs text-slate-400">{dpl.entries.length} items</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">List</th>
                    <th className="px-3 py-2 text-right">Dealer</th>
                    <th className="px-3 py-2 text-left">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dpl.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700">{entry.productName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{entry.sku}</td>
                      <td className="px-3 py-2 text-slate-500">{entry.category}</td>
                      <td className="px-3 py-2 text-right text-slate-600">${entry.listPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">${entry.dealerPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-400 text-xs">{entry.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
