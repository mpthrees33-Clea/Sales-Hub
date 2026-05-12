import { useMemo, useState } from 'react';
import {
  X, Plus, ArrowUp, ArrowDown, Trash2, FileText, Package, Sparkles,
  ChevronDown, Play,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type {
  Presentation, PresentationSlide, PresentationSlideType,
} from '../../types';
import SlideRenderer from './SlideRenderer';
import SearchableCombobox, { type ComboboxOption } from '../common/SearchableCombobox';

interface Props {
  presentation?: Presentation;
  onClose: () => void;
  onPresent?: (id: string) => void;
}

const AUDIENCES = ['Architect', 'Designer', 'Contractor', 'General'] as const;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function PresentationEditor({ presentation, onClose, onPresent }: Props) {
  const brochures = useAppStore((s) => s.brochures);
  const products = useAppStore((s) => s.products);
  const addPresentation = useAppStore((s) => s.addPresentation);
  const updatePresentation = useAppStore((s) => s.updatePresentation);

  const [name, setName] = useState(presentation?.name ?? '');
  const [description, setDescription] = useState(presentation?.description ?? '');
  const [audience, setAudience] = useState(presentation?.targetAudience ?? 'General');
  const [isTemplate, setIsTemplate] = useState(presentation?.isTemplate ?? false);
  const [slides, setSlides] = useState<PresentationSlide[]>(
    presentation?.slides ?? [
      { id: newId('slide'), type: 'title', title: 'New Presentation', subtitle: 'Trinity Surfaces' },
    ],
  );
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [error, setError] = useState('');

  const selectedSlide = slides[selectedSlideIdx];

  function updateSlide(patch: Partial<PresentationSlide>) {
    setSlides((arr) => arr.map((s, i) => (i === selectedSlideIdx ? { ...s, ...patch } : s)));
  }

  function addSlide(type: PresentationSlideType) {
    const newSlide: PresentationSlide = {
      id: newId('slide'),
      type,
      title: type === 'title' ? 'Section Title' : undefined,
      subtitle: type === 'title' ? 'Subtitle' : undefined,
      brochureId: type === 'brochure' ? brochures[0]?.id : undefined,
      spotlightProductIds: type === 'brochure' ? [] : undefined,
      productId: type === 'product' ? products[0]?.id : undefined,
    };
    setSlides((arr) => {
      const next = [...arr];
      next.splice(selectedSlideIdx + 1, 0, newSlide);
      return next;
    });
    setSelectedSlideIdx((i) => i + 1);
    setAddMenuOpen(false);
  }

  function moveSlide(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((arr) => {
      const next = [...arr];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    if (selectedSlideIdx === idx) setSelectedSlideIdx(target);
    else if (selectedSlideIdx === target) setSelectedSlideIdx(idx);
  }

  function deleteSlide(idx: number) {
    if (slides.length === 1) return;
    setSlides((arr) => arr.filter((_, i) => i !== idx));
    setSelectedSlideIdx((i) => Math.max(0, i >= idx ? i - 1 : i));
  }

  function save(): Presentation | undefined {
    if (!name.trim()) { setError('Name is required.'); return undefined; }
    const today = new Date().toISOString().slice(0, 10);
    if (presentation) {
      updatePresentation(presentation.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        targetAudience: audience,
        isTemplate,
        slides,
      });
      return { ...presentation, name: name.trim(), description, targetAudience: audience, slides };
    }
    const fresh: Presentation = {
      id: newId('pres'),
      name: name.trim(),
      description: description.trim() || undefined,
      targetAudience: audience,
      isTemplate,
      slides,
      tags: [],
      createdDate: today,
      modifiedDate: today,
    };
    addPresentation(fresh);
    return fresh;
  }

  function saveAndClose() {
    if (save()) onClose();
  }

  function saveAndPresent() {
    const saved = save();
    if (saved && onPresent) {
      onPresent(saved.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-2 md:p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-6xl my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-divider shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-fg">
              {presentation ? 'Edit Presentation' : 'New Presentation'}
            </h2>
            <p className="text-xs text-fg-muted">{slides.length} slide{slides.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <button
              type="button"
              onClick={saveAndPresent}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-success text-white text-sm rounded-lg hover:bg-success/90"
              title="Save + jump to present mode"
            >
              <Play size={13} /> Save & present
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-1"><X size={16} /></button>
          </div>
        </div>

        {error && <p className="mx-5 mt-3 text-xs text-danger bg-danger/10 px-3 py-2 rounded">{error}</p>}

        {/* Metadata strip */}
        <div className="px-5 py-3 border-b border-divider grid grid-cols-1 md:grid-cols-12 gap-2 shrink-0">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-fg-muted mb-1">Name *</label>
            <input
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              value={name} onChange={(e) => setName(e.target.value)} placeholder="Commercial LVP — Greer pitch"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-fg-muted mb-1">Description</label>
            <input
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional internal note"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-fg-muted mb-1">Audience</label>
            <select
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              value={audience} onChange={(e) => setAudience(e.target.value as typeof AUDIENCES[number])}
            >
              {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="md:col-span-1 flex items-end pb-1.5">
            <label className="flex items-center gap-1.5 text-xs text-fg-muted cursor-pointer">
              <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
              Template
            </label>
          </div>
        </div>

        {/* Body — slide list + preview/edit */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left: slide list */}
          <div className="md:w-72 shrink-0 border-r border-divider flex flex-col bg-bg/40">
            <div className="p-3 border-b border-divider relative">
              <button
                onClick={() => setAddMenuOpen((v) => !v)}
                className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dim"
              >
                <Plus size={14} /> Add slide
                <ChevronDown size={12} className={clsx('transition-transform', addMenuOpen && 'rotate-180')} />
              </button>
              {addMenuOpen && (
                <div className="absolute z-10 left-3 right-3 mt-1 bg-surface border border-divider rounded-lg shadow-lg overflow-hidden">
                  <AddMenuItem icon={FileText} label="Brochure slide" onClick={() => addSlide('brochure')} />
                  <AddMenuItem icon={Sparkles} label="Section title" onClick={() => addSlide('title')} />
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {slides.map((s, i) => (
                <SlideListItem
                  key={s.id}
                  slide={s}
                  index={i}
                  selected={i === selectedSlideIdx}
                  brochureName={brochures.find((b) => b.id === s.brochureId)?.name}
                  productName={products.find((p) => p.id === s.productId)?.trinityName}
                  onSelect={() => setSelectedSlideIdx(i)}
                  onUp={() => moveSlide(i, -1)}
                  onDown={() => moveSlide(i, 1)}
                  onDelete={() => deleteSlide(i)}
                  canDelete={slides.length > 1}
                  isFirst={i === 0}
                  isLast={i === slides.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Right: preview + per-slide editor */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-divider bg-bg/20">
              <div className="mx-auto" style={{ maxWidth: 640 }}>
                <SlideRenderer
                  slide={selectedSlide}
                  brochures={brochures}
                  products={products}
                  index={selectedSlideIdx}
                  total={slides.length}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <SlideEditor
                slide={selectedSlide}
                onChange={updateSlide}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-divider shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-fg-muted rounded-lg hover:bg-surface-1">
            Cancel
          </button>
          <button onClick={saveAndClose} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim">
            {presentation ? 'Save changes' : 'Create presentation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function AddMenuItem({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-accent/10 transition-colors"
    >
      <Icon size={14} className="text-accent-light" /> {label}
    </button>
  );
}

function SlideListItem({
  slide, index, selected, brochureName, productName,
  onSelect, onUp, onDown, onDelete, canDelete, isFirst, isLast,
}: {
  slide: PresentationSlide;
  index: number;
  selected: boolean;
  brochureName?: string;
  productName?: string;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  canDelete: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const Icon = slide.type === 'brochure' ? FileText : slide.type === 'product' ? Package : Sparkles;
  const label = slide.type === 'title'
    ? (slide.title || 'Untitled')
    : slide.type === 'brochure'
    ? (brochureName ?? 'Brochure not set')
    : (productName ?? 'Product not set');

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'group px-3 py-2 border-b border-divider cursor-pointer flex items-start gap-2',
        selected ? 'bg-accent/15' : 'hover:bg-surface-1',
      )}
    >
      <span className={clsx('text-xs font-mono pt-0.5 shrink-0',
        selected ? 'text-accent-light font-semibold' : 'text-fg-faint',
      )}>{index + 1}</span>
      <Icon size={13} className={clsx('mt-0.5 shrink-0', selected ? 'text-accent-light' : 'text-fg-muted')} />
      <div className="flex-1 min-w-0">
        <p className={clsx('text-xs uppercase tracking-widest',
          selected ? 'text-accent-light' : 'text-fg-faint',
        )}>{slide.type}</p>
        <p className={clsx('text-sm leading-tight truncate', selected ? 'text-fg font-medium' : 'text-fg-muted')}>
          {label}
        </p>
      </div>
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onUp(); }} disabled={isFirst}
          className="p-0.5 text-fg-faint hover:text-fg-muted disabled:opacity-30">
          <ArrowUp size={11} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDown(); }} disabled={isLast}
          className="p-0.5 text-fg-faint hover:text-fg-muted disabled:opacity-30">
          <ArrowDown size={11} />
        </button>
        {canDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-0.5 text-fg-faint hover:text-danger">
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function SlideEditor({
  slide,
  onChange,
}: {
  slide: PresentationSlide;
  onChange: (patch: Partial<PresentationSlide>) => void;
}) {
  const brochures = useAppStore((s) => s.brochures);
  const products = useAppStore((s) => s.products);

  const brochureOptions = useMemo<ComboboxOption[]>(() =>
    brochures.map((b) => ({
      value: b.id,
      label: b.name,
      sublabel: `${b.brand} · ${b.category}${b.pageCount ? ` · ${b.pageCount}pp` : ''}`,
    })), [brochures],
  );

  const productOptions = useMemo<ComboboxOption[]>(() =>
    products.map((p) => ({
      value: p.id,
      label: p.trinityName,
      sublabel: `${p.category} · ${p.privateLabels.slice(0, 2).map((pl) => pl.brand).join(', ')}`,
    })), [products],
  );

  // For brochure slides — pick spotlight products from the brochure's own
  // product list when available, else all products.
  const currentBrochure = slide.type === 'brochure' ? brochures.find((b) => b.id === slide.brochureId) : undefined;
  const spotlightCandidates = currentBrochure?.productIds.length
    ? products.filter((p) => currentBrochure.productIds.includes(p.id))
    : products;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-fg-muted uppercase tracking-widest">Slide settings</p>

      {slide.type === 'title' && (
        <>
          <Field label="Title">
            <input
              className={inputCls}
              value={slide.title ?? ''} onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Trinity Hardwood Collection"
            />
          </Field>
          <Field label="Subtitle">
            <input
              className={inputCls}
              value={slide.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })}
              placeholder="For your next premium-residential project"
            />
          </Field>
        </>
      )}

      {slide.type === 'brochure' && (
        <>
          <Field label="Brochure">
            <SearchableCombobox
              value={slide.brochureId ?? ''}
              onChange={(v) => onChange({ brochureId: v })}
              options={brochureOptions}
              placeholder="Pick a brochure…"
            />
          </Field>
          <Field label="Featured products (optional)">
            <SpotlightProductPicker
              available={spotlightCandidates}
              selected={slide.spotlightProductIds ?? []}
              onChange={(ids) => onChange({ spotlightProductIds: ids })}
            />
          </Field>
          <Field label="Title override (optional)">
            <input
              className={inputCls}
              value={slide.title ?? ''} onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Defaults to the brochure name"
            />
          </Field>
        </>
      )}

      {slide.type === 'product' && (
        <Field label="Product">
          <SearchableCombobox
            value={slide.productId ?? ''}
            onChange={(v) => onChange({ productId: v })}
            options={productOptions}
            placeholder="Pick a product…"
          />
        </Field>
      )}

      <Field label="Speaker notes (editor-only)">
        <textarea
          className={clsx(inputCls, 'resize-y')}
          rows={3}
          value={slide.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="What to say on this slide. Visible to you only, never shown in Present mode."
        />
      </Field>
    </div>
  );
}

const inputCls = 'w-full text-sm border border-divider rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-fg-muted mb-1">{label}</span>
      {children}
    </label>
  );
}

function SpotlightProductPicker({
  available,
  selected,
  onChange,
}: {
  available: ReturnType<typeof useAppStore.getState>['products'];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  if (available.length === 0) {
    return <p className="text-xs text-fg-faint italic px-2 py-1.5">Pick a brochure first.</p>;
  }
  return (
    <div className="border border-divider rounded-lg bg-surface max-h-40 overflow-y-auto divide-y divide-divider">
      {available.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
              on ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-surface-1',
            )}
          >
            <input type="checkbox" checked={on} readOnly className="accent-accent pointer-events-none" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg truncate">{p.trinityName}</p>
              <p className="text-xs text-fg-faint truncate">{p.category} · ${p.listPrice}/{p.unit}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
