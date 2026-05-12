import { FileText, Package, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { PresentationSlide, Brochure, Product } from '../../types';

// Landscape (16:9) slide renderer used by both the PresentationEditor
// preview AND the full-screen PresentMode. One component → same look in
// the editor and on the customer-facing big screen.
//
// Variants by slide.type:
//   'title'    → big-heading cover slide
//   'brochure' → brochure card with category accents + product spotlights
//   'product'  → product spec sheet with private-label aliases + key specs

interface Props {
  slide: PresentationSlide;
  brochures: Brochure[];
  products: Product[];
  size?: 'preview' | 'present';   // present = full-screen, preview = scaled
  index?: number;
  total?: number;
}

export default function SlideRenderer({
  slide, brochures, products, size = 'preview', index, total,
}: Props) {
  const isPresent = size === 'present';
  const padCls = isPresent ? 'p-12' : 'p-6';
  const titleCls = isPresent ? 'text-5xl' : 'text-2xl';
  const bodyCls = isPresent ? 'text-2xl leading-relaxed' : 'text-base leading-relaxed';

  const counterBadge = index !== undefined && total !== undefined && (
    <span className={clsx(
      'absolute top-4 right-4 font-mono text-fg-faint',
      isPresent ? 'text-base' : 'text-xs',
    )}>
      {index + 1} / {total}
    </span>
  );

  // ── Title slide ────────────────────────────────────────────
  if (slide.type === 'title') {
    return (
      <div className={clsx(
        'relative aspect-video w-full h-full rounded-xl border border-divider overflow-hidden',
        'bg-gradient-to-br from-bg via-surface to-surface-1',
      )}>
        {counterBadge}
        <div className={clsx('flex flex-col items-center justify-center h-full', padCls)}>
          <div className={clsx('rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mb-6',
            isPresent ? 'w-20 h-20' : 'w-12 h-12',
          )}>
            <Sparkles size={isPresent ? 36 : 22} className="text-accent-light" />
          </div>
          <h1 className={clsx('font-semibold text-fg text-center tracking-tight', titleCls)}>
            {slide.title || 'Untitled'}
          </h1>
          {slide.subtitle && (
            <p className={clsx('text-fg-muted mt-3 text-center', isPresent ? 'text-2xl' : 'text-base')}>
              {slide.subtitle}
            </p>
          )}
          <div className={clsx('mt-8 text-fg-faint uppercase tracking-widest',
            isPresent ? 'text-base' : 'text-xs',
          )}>
            Trinity Surfaces
          </div>
        </div>
      </div>
    );
  }

  // ── Brochure slide ─────────────────────────────────────────
  if (slide.type === 'brochure') {
    const brochure = brochures.find((b) => b.id === slide.brochureId);
    const spotlightProducts = (slide.spotlightProductIds ?? [])
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
    return (
      <div className={clsx(
        'relative aspect-video w-full h-full rounded-xl border border-divider overflow-hidden bg-surface',
      )}>
        {counterBadge}
        <div className={clsx('flex h-full', padCls)}>
          {/* Left side: brochure "cover" */}
          <div className={clsx(
            'shrink-0 rounded-xl bg-gradient-to-br from-accent/20 via-accent/10 to-surface-1',
            'border border-accent/30 flex flex-col justify-between',
            isPresent ? 'w-72 p-8' : 'w-40 p-4',
          )}>
            <div className={clsx('rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center self-start',
              isPresent ? 'w-14 h-14' : 'w-10 h-10',
            )}>
              <FileText size={isPresent ? 28 : 18} className="text-accent-light" />
            </div>
            <div>
              <p className={clsx('text-accent-light font-medium uppercase tracking-widest',
                isPresent ? 'text-sm' : 'text-[10px]',
              )}>{brochure?.category ?? 'Catalog'}</p>
              <h2 className={clsx('font-semibold text-fg mt-2 leading-tight',
                isPresent ? 'text-2xl' : 'text-sm',
              )}>{brochure?.name ?? slide.title ?? 'Brochure'}</h2>
              <p className={clsx('text-fg-muted mt-2', isPresent ? 'text-lg' : 'text-xs')}>
                {brochure?.brand ?? '—'}
                {brochure?.pageCount ? ` · ${brochure.pageCount} pages` : ''}
              </p>
            </div>
          </div>

          {/* Right side: details + spotlight products */}
          <div className={clsx('flex-1 min-w-0 flex flex-col', isPresent ? 'pl-12' : 'pl-6')}>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {brochure?.tags.slice(0, 4).map((t) => (
                <span key={t} className={clsx('px-2 py-0.5 rounded font-medium bg-surface-1 text-fg-muted',
                  isPresent ? 'text-sm' : 'text-xs',
                )}>{t}</span>
              ))}
            </div>
            {brochure?.description && (
              <p className={clsx('text-fg-muted', bodyCls, isPresent ? 'mb-6' : 'mb-3')}>
                {brochure.description}
              </p>
            )}

            {spotlightProducts.length > 0 && (
              <div className="flex-1 min-h-0">
                <p className={clsx('font-semibold text-fg-muted uppercase tracking-widest mb-2',
                  isPresent ? 'text-sm' : 'text-[10px]',
                )}>Featured products</p>
                <div className={clsx('grid gap-2', isPresent ? 'grid-cols-2 gap-4' : 'grid-cols-2')}>
                  {spotlightProducts.slice(0, 4).map((p) => (
                    <div key={p.id} className={clsx('rounded-lg border border-divider bg-bg/40',
                      isPresent ? 'p-4' : 'p-2',
                    )}>
                      <p className={clsx('font-medium text-fg leading-tight', isPresent ? 'text-lg' : 'text-sm')}>
                        {p.trinityName}
                      </p>
                      <p className={clsx('text-fg-muted', isPresent ? 'text-sm' : 'text-xs')}>
                        {p.category}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Product slide ──────────────────────────────────────────
  if (slide.type === 'product') {
    const product = products.find((p) => p.id === slide.productId);
    if (!product) {
      return (
        <div className="relative aspect-video w-full h-full rounded-xl border border-divider bg-surface flex items-center justify-center">
          {counterBadge}
          <p className="text-fg-faint italic">Product not found.</p>
        </div>
      );
    }
    const specEntries = Object.entries(product.specs).slice(0, 6);
    return (
      <div className="relative aspect-video w-full h-full rounded-xl border border-divider overflow-hidden bg-surface">
        {counterBadge}
        <div className={clsx('flex h-full', padCls)}>
          <div className={clsx('shrink-0 rounded-xl bg-gradient-to-br from-accent-dim via-accent/30 to-accent-light',
            'flex items-center justify-center',
            isPresent ? 'w-72' : 'w-44',
          )}>
            <Package size={isPresent ? 96 : 48} className="text-white opacity-90" />
          </div>
          <div className={clsx('flex-1 min-w-0 flex flex-col', isPresent ? 'pl-12' : 'pl-6')}>
            <p className={clsx('text-accent-light font-medium uppercase tracking-widest',
              isPresent ? 'text-sm' : 'text-[10px]',
            )}>
              {product.category}
            </p>
            <h2 className={clsx('font-semibold text-fg leading-tight mt-1', titleCls)}>
              {product.trinityName}
            </h2>
            <p className={clsx('text-fg-muted mt-2 font-mono', isPresent ? 'text-base' : 'text-xs')}>
              {product.trinitySku}
            </p>

            <p className={clsx('text-fg-muted mt-3', bodyCls)}>{product.description}</p>

            {specEntries.length > 0 && (
              <div className={clsx('grid grid-cols-2 mt-4', isPresent ? 'gap-3' : 'gap-1.5')}>
                {specEntries.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className={clsx('text-fg-faint capitalize', isPresent ? 'text-base' : 'text-xs')}>{k}:</span>
                    <span className={clsx('text-fg font-medium', isPresent ? 'text-base' : 'text-xs')}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {product.privateLabels.length > 0 && (
              <div className="mt-auto">
                <p className={clsx('text-fg-faint uppercase tracking-widest mt-3',
                  isPresent ? 'text-sm' : 'text-[10px]',
                )}>Also sold as</p>
                <p className={clsx('text-fg-muted', isPresent ? 'text-base' : 'text-xs')}>
                  {product.privateLabels.slice(0, 3).map((pl) => `${pl.brand} ${pl.productName}`).join(' · ')}
                </p>
              </div>
            )}
            {/* No price on presentation slides — reps quote budget numbers
                in the room, not list prices. */}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
