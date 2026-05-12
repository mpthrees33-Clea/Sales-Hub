import { useState } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type { Quote, QuoteLineItem } from '../../types';
import { quotes as quotesService } from '../../services/quotes';
import { buildLineItem } from '../../lib/pricing';

// Renders the auto-generated Quote attached to an email draft. Read-only by
// default; each line item has an inline "Edit" affordance that lets the rep
// fill in [NEEDED: ...] placeholders. Recomputes price from the pricing
// engine on save (deterministic, no LLM).

interface Props {
  quote: Quote;
  readOnly?: boolean;
}

export default function QuoteTable({ quote, readOnly }: Props) {
  const products = useAppStore((s) => s.products);
  const priceEntries = useAppStore((s) => s.priceEntries);
  const [editingId, setEditingId] = useState<string | null>(null);

  function saveEdit(itemId: string, patch: Partial<QuoteLineItem>) {
    const item = quote.lineItems.find((li) => li.id === itemId);
    if (!item) return;
    // Re-run the pricing engine with the merged spec so unit price/total
    // refresh deterministically. placeholderFields is recomputed there.
    const refreshed = buildLineItem(
      {
        productName: patch.productName ?? item.productName,
        productId: item.productId,
        size: patch.size ?? item.size,
        color: patch.color ?? item.color,
        finish: patch.finish ?? item.finish,
        quantity: patch.quantity ?? item.quantity,
        unit: patch.unit ?? item.unit,
      },
      products,
      priceEntries,
    );
    // Preserve the original line-item id so the React list keys stay stable.
    const updatedItem: QuoteLineItem = { ...refreshed, id: item.id };

    const newItems = quote.lineItems.map((li) => (li.id === itemId ? updatedItem : li));
    const subtotal = newItems.reduce((sum, li) => sum + (li.totalPrice ?? 0), 0);
    quotesService.update(quote.id, {
      lineItems: newItems,
      subtotal: subtotal > 0 ? Math.round(subtotal * 100) / 100 : undefined,
    });
    setEditingId(null);
  }

  return (
    <div className="border border-divider rounded-lg bg-surface/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-divider bg-surface-1">
        <p className="text-xs font-semibold text-fg">Quote scaffold</p>
        <p className="text-xs text-fg-faint">{quote.lineItems.length} line item{quote.lineItems.length === 1 ? '' : 's'}</p>
      </div>

      {/* Desktop table — hidden on mobile in favor of stacked cards */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface text-fg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Product</th>
              <th className="text-left px-3 py-2 font-medium">Size</th>
              <th className="text-left px-3 py-2 font-medium">Color</th>
              <th className="text-left px-3 py-2 font-medium">Finish</th>
              <th className="text-right px-3 py-2 font-medium">Qty</th>
              <th className="text-right px-3 py-2 font-medium">Unit $</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map((li) =>
              editingId === li.id ? (
                <EditRow
                  key={li.id}
                  item={li}
                  onSave={(patch) => saveEdit(li.id, patch)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <ReadRow
                  key={li.id}
                  item={li}
                  editable={!readOnly}
                  onEdit={() => setEditingId(li.id)}
                />
              ),
            )}
          </tbody>
          <tfoot className="bg-surface-1 border-t border-divider">
            <tr>
              <td colSpan={6} className="px-3 py-2 text-right text-xs font-medium text-fg-muted">Subtotal:</td>
              <td className="px-3 py-2 text-right text-sm font-semibold text-fg">
                {quote.subtotal !== undefined ? `$${quote.subtotal.toFixed(2)}` : '—'}
              </td>
              {!readOnly && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden divide-y divide-divider">
        {quote.lineItems.map((li) =>
          editingId === li.id ? (
            <EditCard
              key={li.id}
              item={li}
              onSave={(patch) => saveEdit(li.id, patch)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <ReadCard
              key={li.id}
              item={li}
              editable={!readOnly}
              onEdit={() => setEditingId(li.id)}
            />
          ),
        )}
        <div className="flex justify-between items-center px-3 py-2 bg-surface-1">
          <span className="text-xs font-medium text-fg-muted">Subtotal</span>
          <span className="text-sm font-semibold text-fg">
            {quote.subtotal !== undefined ? `$${quote.subtotal.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Cell helpers ───────────────────────────────────────────────
function PlaceholderCell({ value, isMissing }: { value: string | undefined; isMissing: boolean }) {
  if (isMissing) {
    return <span className="text-danger text-xs font-mono">[NEEDED]</span>;
  }
  return <span className="text-fg">{value ?? '—'}</span>;
}

function NumberCell({ value, unit, isMissing }: { value: number | undefined; unit?: string; isMissing: boolean }) {
  if (isMissing) {
    return <span className="text-danger text-xs font-mono">[NEEDED]</span>;
  }
  if (value === undefined) return <span className="text-fg">—</span>;
  return (
    <span className="text-fg">
      {value.toLocaleString()}{unit ? ` ${unit}` : ''}
    </span>
  );
}

function PriceCell({ value, pending }: { value: number | undefined; pending: boolean }) {
  if (pending) return <span className="text-fg-faint italic text-xs">pricing pending</span>;
  if (value === undefined) return <span className="text-fg">—</span>;
  return <span className="text-fg">${value.toFixed(2)}</span>;
}

// ── Read-only row (desktop) ────────────────────────────────────
function ReadRow({
  item,
  editable,
  onEdit,
}: {
  item: QuoteLineItem;
  editable: boolean;
  onEdit: () => void;
}) {
  const missing = new Set(item.placeholderFields ?? []);
  return (
    <tr className="border-t border-divider hover:bg-surface/40">
      <td className="px-3 py-2 font-medium text-fg">{item.productName}</td>
      <td className="px-3 py-2"><PlaceholderCell value={item.size} isMissing={missing.has('size')} /></td>
      <td className="px-3 py-2"><PlaceholderCell value={item.color} isMissing={missing.has('color')} /></td>
      <td className="px-3 py-2"><PlaceholderCell value={item.finish} isMissing={missing.has('finish')} /></td>
      <td className="px-3 py-2 text-right"><NumberCell value={item.quantity} unit={item.unit} isMissing={missing.has('quantity')} /></td>
      <td className="px-3 py-2 text-right"><PriceCell value={item.unitPrice} pending={!!item.pricingPending} /></td>
      <td className="px-3 py-2 text-right font-medium text-fg">
        <PriceCell value={item.totalPrice} pending={!!item.pricingPending} />
      </td>
      {editable && (
        <td className="px-2 py-2 text-right">
          <button
            onClick={onEdit}
            className="p-1 rounded text-fg-muted hover:bg-surface-1 hover:text-fg"
            title="Edit line item"
          >
            <Edit3 size={13} />
          </button>
        </td>
      )}
    </tr>
  );
}

// ── Read-only card (mobile) ────────────────────────────────────
function ReadCard({
  item,
  editable,
  onEdit,
}: {
  item: QuoteLineItem;
  editable: boolean;
  onEdit: () => void;
}) {
  const missing = new Set(item.placeholderFields ?? []);
  return (
    <div className="px-3 py-2 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-fg">{item.productName}</p>
        {editable && (
          <button onClick={onEdit} className="p-1 rounded text-fg-muted hover:bg-surface-1 hover:text-fg" title="Edit">
            <Edit3 size={12} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <SpecRow label="Size" value={item.size} missing={missing.has('size')} />
        <SpecRow label="Color" value={item.color} missing={missing.has('color')} />
        <SpecRow label="Finish" value={item.finish} missing={missing.has('finish')} />
        <SpecRow
          label="Qty"
          value={item.quantity !== undefined ? `${item.quantity.toLocaleString()} ${item.unit}` : undefined}
          missing={missing.has('quantity')}
        />
      </div>
      <p className="text-xs text-right">
        {item.pricingPending ? (
          <span className="text-fg-faint italic">pricing pending</span>
        ) : (
          <span className="font-medium text-fg">
            {item.unitPrice !== undefined ? `$${item.unitPrice.toFixed(2)}/${item.unit}` : '—'}
            {item.totalPrice !== undefined ? ` · $${item.totalPrice.toFixed(2)}` : ''}
          </span>
        )}
      </p>
    </div>
  );
}

function SpecRow({ label, value, missing }: { label: string; value: string | undefined; missing: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-fg-faint">{label}:</span>
      {missing ? (
        <span className="text-danger font-mono">[NEEDED]</span>
      ) : (
        <span className="text-fg">{value ?? '—'}</span>
      )}
    </div>
  );
}

// ── Edit row (desktop) ─────────────────────────────────────────
function EditRow({
  item,
  onSave,
  onCancel,
}: {
  item: QuoteLineItem;
  onSave: (patch: Partial<QuoteLineItem>) => void;
  onCancel: () => void;
}) {
  const [size, setSize] = useState(item.size ?? '');
  const [color, setColor] = useState(item.color ?? '');
  const [finish, setFinish] = useState(item.finish ?? '');
  const [qty, setQty] = useState(item.quantity?.toString() ?? '');

  function commit() {
    const q = parseFloat(qty.replace(/,/g, ''));
    onSave({
      size: size.trim() || undefined,
      color: color.trim() || undefined,
      finish: finish.trim() || undefined,
      quantity: isFinite(q) && q > 0 ? q : undefined,
    });
  }

  return (
    <tr className="border-t border-divider bg-accent/5">
      <td className="px-3 py-2 font-medium text-fg align-top">{item.productName}</td>
      <td className="px-2 py-1"><Cell value={size} onChange={setSize} placeholder="12x24" /></td>
      <td className="px-2 py-1"><Cell value={color} onChange={setColor} placeholder="Stone Grey" /></td>
      <td className="px-2 py-1"><Cell value={finish} onChange={setFinish} placeholder="matte" /></td>
      <td className="px-2 py-1"><Cell value={qty} onChange={setQty} placeholder="8200" align="right" /></td>
      <td className="px-3 py-2 text-fg-faint text-xs">recalc on save</td>
      <td />
      <td className="px-2 py-1 flex gap-1">
        <button onClick={commit} className="p-1 rounded bg-accent text-white hover:bg-accent-dim" title="Save">
          <Check size={13} />
        </button>
        <button onClick={onCancel} className="p-1 rounded text-fg-muted hover:bg-surface-1 hover:text-fg" title="Cancel">
          <X size={13} />
        </button>
      </td>
    </tr>
  );
}

// ── Edit card (mobile) ─────────────────────────────────────────
function EditCard({
  item,
  onSave,
  onCancel,
}: {
  item: QuoteLineItem;
  onSave: (patch: Partial<QuoteLineItem>) => void;
  onCancel: () => void;
}) {
  const [size, setSize] = useState(item.size ?? '');
  const [color, setColor] = useState(item.color ?? '');
  const [finish, setFinish] = useState(item.finish ?? '');
  const [qty, setQty] = useState(item.quantity?.toString() ?? '');

  function commit() {
    const q = parseFloat(qty.replace(/,/g, ''));
    onSave({
      size: size.trim() || undefined,
      color: color.trim() || undefined,
      finish: finish.trim() || undefined,
      quantity: isFinite(q) && q > 0 ? q : undefined,
    });
  }

  return (
    <div className="px-3 py-3 bg-accent/5 space-y-2">
      <p className="text-sm font-medium text-fg">{item.productName}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Size"><Cell value={size} onChange={setSize} placeholder="12x24" /></Field>
        <Field label="Color"><Cell value={color} onChange={setColor} placeholder="Stone Grey" /></Field>
        <Field label="Finish"><Cell value={finish} onChange={setFinish} placeholder="matte" /></Field>
        <Field label="Qty"><Cell value={qty} onChange={setQty} placeholder="8200" /></Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-2.5 py-1 text-xs text-fg-muted border border-divider rounded hover:bg-surface-1">Cancel</button>
        <button onClick={commit} className="px-2.5 py-1 text-xs bg-accent text-white rounded hover:bg-accent-dim">Save</button>
      </div>
    </div>
  );
}

function Cell({
  value,
  onChange,
  placeholder,
  align,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  align?: 'right' | 'left';
}) {
  return (
    <input
      className={clsx(
        'w-full text-xs border border-divider rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-accent',
        align === 'right' && 'text-right',
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-fg-faint mb-0.5">{label}</span>
      {children}
    </label>
  );
}
