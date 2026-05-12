import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileText, BookOpen, Plus, Search, Copy, Edit2, Trash2, Presentation as PresentationIcon, Play } from 'lucide-react';
// Trash2 is still used by Catalog + Presentation cards (catalogs and
// presentations remain deletable). Brochures themselves are read-only.
import type { Brochure, Catalog, Presentation } from '../types';
import UploadModal, { getFile } from '../components/brochures/UploadModal';
import CatalogModal from '../components/brochures/CatalogModal';
import PresentationEditor from '../components/brochures/PresentationEditor';
import PresentMode from '../components/brochures/PresentMode';

const CAT_COLORS: Record<string, string> = {
  LVP:                    'bg-accent/15 text-accent-light',
  SPC:                    'bg-accent/20 text-accent-light',
  Hardwood:               'bg-warning/15 text-warning',
  'Engineered Hardwood':  'bg-warning/10 text-warning',
  Laminate:               'bg-warning/20 text-warning',
  Carpet:                 'bg-accent/10 text-accent-light',
  Tile:                   'bg-surface-1 text-fg-muted',
  Cork:                   'bg-success/15 text-success',
  Bamboo:                 'bg-success/20 text-success',
  Other:                  'bg-surface-1 text-fg-muted',
};

// Brochures are reference assets — reps view, attach, and present them but
// don't delete them (they're shared across the org's catalog system).
function BrochureCard({ brochure }: { brochure: Brochure }) {
  const fileUrl = brochure.hasFile ? getFile(brochure.id) : undefined;
  return (
    <div className="bg-surface rounded-lg border border-divider p-4 flex gap-3 group relative">
      <div className="p-2 bg-accent/10 rounded-lg self-start shrink-0">
        <FileText size={18} className="text-accent-light" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-fg text-sm leading-tight">{brochure.name}</p>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer"
              className="text-xs px-2 py-0.5 text-accent-light border border-accent/30 rounded hover:bg-accent/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">View</a>
          )}
        </div>
        <p className="text-xs text-fg-muted">{brochure.brand} · {brochure.category}</p>
        {brochure.pageCount && <p className="text-xs text-fg-faint">{brochure.pageCount} pages</p>}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CAT_COLORS[brochure.category] ?? 'bg-surface-1 text-fg-muted'}`}>
            {brochure.category}
          </span>
          {brochure.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-xs bg-surface-1 text-fg-faint px-1.5 py-0.5 rounded">{t}</span>
          ))}
          {brochure.hasFile && <span className="w-2 h-2 bg-success rounded-full" title="File uploaded" />}
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
    <div className="bg-surface rounded-lg border border-divider p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3">
          <div className="p-2 bg-accent/10 rounded-lg self-start"><BookOpen size={18} className="text-accent-light" /></div>
          <div>
            <p className="font-medium text-fg text-sm">{catalog.name}</p>
            <p className="text-xs text-fg-muted">{catalog.targetAudience} · v{catalog.version}</p>
            <div className="flex gap-1 mt-1 flex-wrap">
              {catalog.isTemplate && <span className="text-xs bg-accent/15 text-accent-light px-1.5 py-0.5 rounded font-medium">Template</span>}
              {catalog.parentCatalogId && <span className="text-xs bg-success/15 text-success px-1.5 py-0.5 rounded font-medium">Custom Clone</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {catalog.isTemplate && (
            <button onClick={onClone} className="p-1.5 text-fg-faint hover:text-accent-light rounded hover:bg-accent/10" title="Clone">
              <Copy size={14} />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-fg-faint hover:text-fg-muted rounded hover:bg-bg" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-fg-faint hover:text-danger rounded hover:bg-danger/10" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="text-xs text-fg-faint mt-2">{count} brochure(s) · updated {catalog.modifiedDate}</p>
    </div>
  );
}

export default function BrochuresPage() {
  const { brochures, catalogs, deleteCatalog, addCatalog,
          presentations, deletePresentation, addPresentation } = useAppStore();
  const [tab, setTab] = useState<'brochures' | 'catalogs' | 'presentations'>('brochures');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | undefined>();
  const [showPresentationEditor, setShowPresentationEditor] = useState(false);
  const [editingPresentation, setEditingPresentation] = useState<Presentation | undefined>();
  const [presentingId, setPresentingId] = useState<string | null>(null);

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

  function clonePresentation(p: Presentation) {
    const today = new Date().toISOString().slice(0, 10);
    addPresentation({
      ...p,
      id: `pres-${Date.now()}`,
      name: `${p.name} (Copy)`,
      isTemplate: false,
      parentPresentationId: p.id,
      createdDate: today,
      modifiedDate: today,
      slides: p.slides.map((s) => ({ ...s, id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    });
  }

  const presentingPresentation = presentingId
    ? presentations.find((p) => p.id === presentingId)
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-divider overflow-x-auto">
        {(['brochures', 'catalogs', 'presentations'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors shrink-0 ${tab === t ? 'border-accent text-accent-light' : 'border-transparent text-fg-muted hover:text-fg'}`}>
            {t === 'brochures' ? `Brochures (${brochures.length})`
              : t === 'catalogs' ? `Catalogs (${catalogs.length})`
              : `Presentations (${presentations.length})`}
          </button>
        ))}
      </div>

      {tab === 'brochures' && (
        <>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-2.5 top-2.5 text-fg-faint" />
              <input className="w-full pl-8 pr-3 py-2 text-sm border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Search brochures..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dim">
              <Plus size={15} /> Upload
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((b) => (
              <BrochureCard key={b.id} brochure={b} />
            ))}
          </div>
        </>
      )}

      {tab === 'catalogs' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => { setEditingCatalog(undefined); setShowCatalogModal(true); }}
              className="flex items-center gap-1 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dim">
              <Plus size={15} /> New Catalog
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {catalogs.map((c) => (
              <CatalogCard key={c.id} catalog={c} brochures={brochures}
                onClone={() => handleClone(c)}
                onEdit={() => { setEditingCatalog(c); setShowCatalogModal(true); }}
                onDelete={() => { if (confirm(`Delete catalog "${c.name}"? This removes the catalog itself; the underlying brochures remain.`)) deleteCatalog(c.id); }} />
            ))}
          </div>
        </>
      )}

      {tab === 'presentations' && (
        <>
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <p className="text-xs text-fg-muted max-w-xl">
              PowerPoint-style slide decks the rep can present on the go. Each deck is an ordered list of brochure
              slides, product spotlights, and section titles — landscape orientation, tap-to-navigate, save to PDF.
            </p>
            <button onClick={() => { setEditingPresentation(undefined); setShowPresentationEditor(true); }}
              className="flex items-center gap-1 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dim shrink-0">
              <Plus size={15} /> New Presentation
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {presentations.length === 0 ? (
              <p className="col-span-2 text-center text-sm text-fg-faint italic py-12">
                No presentations yet. Start with "New Presentation" or clone one of the templates.
              </p>
            ) : presentations.map((p) => (
              <PresentationCard key={p.id} presentation={p}
                onPresent={() => setPresentingId(p.id)}
                onClone={() => clonePresentation(p)}
                onEdit={() => { setEditingPresentation(p); setShowPresentationEditor(true); }}
                onDelete={() => { if (confirm(`Delete presentation "${p.name}"?`)) deletePresentation(p.id); }}
              />
            ))}
          </div>
        </>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {showCatalogModal && <CatalogModal catalog={editingCatalog} onClose={() => { setShowCatalogModal(false); setEditingCatalog(undefined); }} />}
      {showPresentationEditor && (
        <PresentationEditor
          presentation={editingPresentation}
          onClose={() => { setShowPresentationEditor(false); setEditingPresentation(undefined); }}
          onPresent={(id) => {
            setShowPresentationEditor(false);
            setEditingPresentation(undefined);
            setPresentingId(id);
          }}
        />
      )}
      {presentingPresentation && (
        <PresentMode
          presentation={presentingPresentation}
          onClose={() => setPresentingId(null)}
        />
      )}
    </div>
  );
}

function PresentationCard({ presentation, onPresent, onClone, onEdit, onDelete }: {
  presentation: Presentation;
  onPresent: () => void;
  onClone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-surface rounded-lg border border-divider p-4 hover:border-divider-strong transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3 min-w-0">
          <div className="p-2 bg-accent/10 rounded-lg self-start shrink-0">
            <PresentationIcon size={18} className="text-accent-light" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-fg text-sm leading-tight">{presentation.name}</p>
            <p className="text-xs text-fg-muted mt-0.5">
              {presentation.slides.length} slide{presentation.slides.length === 1 ? '' : 's'} · {presentation.targetAudience}
            </p>
            <div className="flex gap-1 mt-1 flex-wrap">
              {presentation.isTemplate && (
                <span className="text-xs bg-accent/15 text-accent-light px-1.5 py-0.5 rounded font-medium">Template</span>
              )}
              {presentation.parentPresentationId && (
                <span className="text-xs bg-success/15 text-success px-1.5 py-0.5 rounded font-medium">Custom Clone</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {presentation.isTemplate && (
            <button onClick={onClone} className="p-1.5 text-fg-faint hover:text-accent-light rounded hover:bg-accent/10" title="Clone">
              <Copy size={14} />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-fg-faint hover:text-fg-muted rounded hover:bg-bg" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-fg-faint hover:text-danger rounded hover:bg-danger/10" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {presentation.description && (
        <p className="text-xs text-fg-muted mt-2 leading-relaxed line-clamp-2">{presentation.description}</p>
      )}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-divider">
        <p className="text-xs text-fg-faint">Updated {presentation.modifiedDate}</p>
        <button
          onClick={onPresent}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-success text-white text-xs rounded-lg hover:bg-success/90 font-medium"
        >
          <Play size={12} /> Present
        </button>
      </div>
    </div>
  );
}
