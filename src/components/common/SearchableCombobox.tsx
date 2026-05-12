import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import clsx from 'clsx';

// Combobox-style picker: button that opens a filterable dropdown. Used by
// the stakeholder pickers in CRM since the real customer list will be too
// long for a native <select> to navigate. Type-ahead narrows in real time,
// click-outside dismisses, esc clears.

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  pinned?: boolean;   // pinned options render at the top above filtered results
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  size?: 'sm' | 'md';
}

export default function SearchableCombobox({
  value, onChange, options, placeholder, emptyText, size = 'md',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const { pinned, filtered } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pinnedItems = options.filter((o) => o.pinned);
    const restItems = options.filter((o) => !o.pinned);
    const filterFn = (o: ComboboxOption) =>
      !q ||
      o.label.toLowerCase().includes(q) ||
      (o.sublabel?.toLowerCase().includes(q) ?? false);
    return {
      pinned: pinnedItems.filter(filterFn),
      filtered: restItems.filter(filterFn),
    };
  }, [query, options]);

  const buttonCls = clsx(
    'w-full text-left border border-divider rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent flex items-center gap-2',
    size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-2',
  );

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={buttonCls}>
        <span className={clsx('flex-1 truncate', selected ? 'text-fg' : 'text-fg-faint')}>
          {selected ? selected.label : (placeholder || '— Not assigned —')}
        </span>
        {selected && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="p-0.5 -my-0.5 rounded text-fg-faint hover:bg-surface-1 hover:text-fg cursor-pointer"
            title="Clear"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={14} className="text-fg-faint shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-surface border border-divider rounded-lg shadow-lg overflow-hidden">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" />
            <input
              autoFocus
              className="w-full text-sm pl-8 pr-3 py-2 bg-surface-1 border-b border-divider focus:outline-none placeholder:text-fg-faint"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              className="w-full text-left px-3 py-1.5 text-xs text-fg-faint hover:bg-accent/10 border-b border-divider/60 italic"
            >
              — Not assigned —
            </button>
            {pinned.length > 0 && (
              <>
                {pinned.map((o) => (
                  <Option key={`p-${o.value}`} option={o} onPick={() => { onChange(o.value); setOpen(false); setQuery(''); }} highlighted />
                ))}
                <div className="border-t border-divider/60" />
              </>
            )}
            {filtered.length === 0 && pinned.length === 0 ? (
              <p className="px-3 py-3 text-sm text-fg-faint italic">{emptyText ?? 'No matches.'}</p>
            ) : (
              filtered.map((o) => (
                <Option key={o.value} option={o} onPick={() => { onChange(o.value); setOpen(false); setQuery(''); }} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Option({
  option,
  onPick,
  highlighted,
}: {
  option: ComboboxOption;
  onPick: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={clsx(
        'w-full text-left px-3 py-2 transition-colors',
        highlighted ? 'bg-accent/5 hover:bg-accent/15' : 'hover:bg-accent/10',
      )}
    >
      <div className="text-sm text-fg truncate">{option.label}</div>
      {option.sublabel && <div className="text-xs text-fg-faint truncate">{option.sublabel}</div>}
    </button>
  );
}
