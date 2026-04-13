import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileText, BookOpen, Plus, Search, Tag, Copy } from 'lucide-react';
import type { Brochure, Catalog } from '../types';

function BrochureCard({ brochure }: { brochure: Brochure }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex gap-3">
      <div className="p-2 bg-blue-50 rounded-lg self-start">
        <FileText size={18} className="text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">{brochure.name}</p>
        <p className="text-xs text-slate-500">{brochure.brand} · {brochure.category}</p>
        {brochure.pageCount && (
          <p className="text-xs text-slate-400">{brochure.pageCount} pages</p>
        )}
        <div className="flex flex-wrap gap-1 mt-2">
          {brochure.tags.map((t) => (
            <span key={t} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CatalogCard({ catalog, brochures, onClone }: {
  catalog: Catalog;
  brochures: Brochure[];
  onClone: (c: Catalog) => void;
}) {
  const linked = brochures.filter((b) => catalog.brochureIds.includes(b.id));
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3">
          <div className="p-2 bg-violet-50 rounded-lg self-start">
            <BookOpen size={18} className="text-violet-500" />
          </div>
          <div>
            <p className="font-medium text-slate-800">{catalog.name}</p>
            <p className="text-xs text-slate-500">{catalog.targetAudience} · v{catalog.version}</p>
            {catalog.isTemplate && (
              <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">
                Template
              </span>
            )}
            {catalog.parentCatalogId && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium ml-1">
                Custom Clone
              </span>
            )}
          </div>
        </div>
        {catalog.isTemplate && (
          <button
            onClick={() => onClone(catalog)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
          >
            <Copy size={12} /> Clone
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">{linked.length} brochure(s) included</p>
    </div>
  );
}

export default function BrochuresPage() {
  const { brochures, catalogs, addCatalog } = useAppStore();
  const [tab, setTab] = useState<'brochures' | 'catalogs'>('brochures');
  const [search, setSearch] = useState('');

  const filteredBrochures = brochures.filter((b) => {
    const q = search.toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || b.brand.toLowerCase().includes(q) || b.tags.some((t) => t.includes(q));
  });

  function handleClone(template: Catalog) {
    const clone: Catalog = {
      ...template,
      id: `cat-${Date.now()}`,
      name: `${template.name} (Copy)`,
      isTemplate: false,
      parentCatalogId: template.id,
      createdDate: new Date().toISOString().slice(0, 10),
      modifiedDate: new Date().toISOString().slice(0, 10),
      customerId: undefined,
    };
    addCatalog(clone);
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['brochures', 'catalogs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'brochures' ? `Brochures (${brochures.length})` : `Catalogs (${catalogs.length})`}
          </button>
        ))}
      </div>

      {tab === 'brochures' && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search brochures..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={15} /> Upload
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredBrochures.map((b) => (
              <BrochureCard key={b.id} brochure={b} />
            ))}
          </div>
        </>
      )}

      {tab === 'catalogs' && (
        <>
          <div className="flex justify-end">
            <button className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={15} /> New Catalog
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {catalogs.map((c) => (
              <CatalogCard key={c.id} catalog={c} brochures={brochures} onClone={handleClone} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
