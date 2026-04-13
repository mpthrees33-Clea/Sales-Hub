import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileText, BookOpen, Plus, Search, Copy, Edit2, Trash2 } from 'lucide-react';
import type { Brochure, Catalog } from '../types';
import UploadModal, { getFile } from '../components/brochures/UploadModal';
import CatalogModal from '../components/brochures/CatalogModal';

const CAT_COLORS: Record<string, string> = {
  LVP: 'bg-blue-100 text-blue-700', SPC: 'bg-cyan-100 text-cyan-700',
  Hardwood: 'bg-amber-100 text-amber-700', 'Engineered Hardwood': 'bg-yellow-100 text-yellow-700',
  Laminate: 'bg-orange-100 text-orange-700', Carpet: 'bg-purple-100 text-purple-700',
  Tile: 'bg-slate-100 text-slate-600', Cork: 'bg-lime-100 text-lime-700',
  Bamboo: 'bg-green-100 text-green-700', Other: 'bg-slate-100 text-slate-500',
};

function BrochureCard({ brochure, onDelete }: { brochure: Brochure; onDelete: () => void }) {
  const fileUrl = brochure.hasFile ? getFile(brochure.id) : undefined;
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex gap-3 group relative">
      <div className="p-2 bg-blue-50 rounded-lg self-start shrink-0">
        <FileText size={18} className="text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-slate-800 text-sm leading-tight">{brochure.name}</p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer"
                className="text-xs px-2 py-0.5 text-blue-600 border border-blue-200 rounded hover:bg-blue-50">View</a>
            )}
            <button onClick={onDelete} className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">{brochure.brand} · {brochure.category}</p>
        {brochure.pageCount && <p className="text-xs text-slate-400">{brochure.pageCount} pages</p>}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CAT_COLORS[brochure.category] ?? 'bg-slate-100 text-slate-500'}`}>
            {brochure.category}
          </span>
          {brochure.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">{t}</span>
          ))}
          {brochure.hasFile && <span className="w-2 h-2 bg-green-400 rounded-full" title="File uploaded" />}
        </div>
      </div>
    </div>
  );
}

function CatalogCard({ catalog, brochures, onClone, onEdit, onDelete }: {
  catalog: Catalog; brochures: Brochure[];
  onClone: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const count = catalog.brochureIds.length;
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3">
          <div className="p-2 bg-violet-50 rounded-lg self-start"><BookOpen size={18} className="text-violet-500" /></div>
          <div>
            <p className="font-medium text-slate-800 text-sm">{catalog.name}</p>
            <p className="text-xs text-slate-500">{catalog.targetAudience} · v{catalog.version}</p>
            <div className="flex gap-1 mt-1 flex-wrap">
              {catalog.isTemplate && <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">Template</span>}
              {catalog.parentCatalogId && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Custom Clone</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {catalog.isTemplate && (
            <button onClick={onClone} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Clone">
              <Copy size={14} />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-50" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">{count} brochure(s) · updated {catalog.modifiedDate}</p>
    </div>
  );
}

export default function BrochuresPage() {
  const { brochures, catalogs, deleteBrochure, deleteCatalog, addCatalog } = useAppStore();
  const [tab, setTab] = useState<'brochures' | 'catalogs'>('brochures');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | undefined>();

  const categories = ['All', ...Array.from(new Set(brochures.map((b) => b.category)))];

  const filtered = brochures.filter((b) => {
    const q = search.toLowerCase();
    const matchQ = !q || b.name.toLowerCase().includes(q) || b.brand.toLowerCase().includes(q) || b.tags.some((t) => t.includes(q));
    const matchCat = catFilter === 'All' || b.category === catFilter;
    return matchQ && matchCat;
  });

  function handleClone(catalog: Catalog) {
    addCatalog({
      ...catalog,
      id: `cat-${Date.now()}`,
      name: `${catalog.name} (Copy)`,
      isTemplate: false,
      parentCatalogId: catalog.id,
      createdDate: new Date().toISOString().slice(0, 10),
      modifiedDate: new Date().toISOString().slice(0, 10),
      customerId: undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200">
        {(['brochures', 'catalogs'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'brochures' ? `Brochures (${brochures.length})` : `Catalogs (${catalogs.length})`}
          </button>
        ))}
      </div>

      {tab === 'brochures' && (
        <>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search brochures..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={15} /> Upload
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((b) => (
              <BrochureCard key={b.id} brochure={b} onDelete={() => deleteBrochure(b.id)} />
            ))}
          </div>
        </>
      )}

      {tab === 'catalogs' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => { setEditingCatalog(undefined); setShowCatalogModal(true); }}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={15} /> New Catalog
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {catalogs.map((c) => (
              <CatalogCard key={c.id} catalog={c} brochures={brochures}
                onClone={() => handleClone(c)}
                onEdit={() => { setEditingCatalog(c); setShowCatalogModal(true); }}
                onDelete={() => deleteCatalog(c.id)} />
            ))}
          </div>
        </>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {showCatalogModal && <CatalogModal catalog={editingCatalog} onClose={() => { setShowCatalogModal(false); setEditingCatalog(undefined); }} />}
    </div>
  );
}
