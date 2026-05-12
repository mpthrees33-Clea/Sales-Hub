import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import type { Presentation } from '../../types';
import SlideRenderer from './SlideRenderer';

// Full-screen presenter view. Renders one landscape slide at a time + keyboard
// (arrow keys / space / esc) and tap-zone (left half = prev, right half =
// next) navigation. Works on a phone or tablet so the rep can present on the
// go in a client meeting.
//
// Print mode: clicking the Printer button calls window.print(). The
// PrintLayout below renders every slide stacked landscape, one per page —
// the browser's "Save as PDF" option then exports the deck.

interface Props {
  presentation: Presentation;
  initialSlide?: number;
  onClose: () => void;
}

export default function PresentMode({ presentation, initialSlide = 0, onClose }: Props) {
  const brochures = useAppStore((s) => s.brochures);
  const products = useAppStore((s) => s.products);
  const [idx, setIdx] = useState(Math.max(0, Math.min(initialSlide, presentation.slides.length - 1)));
  const [chromeVisible, setChromeVisible] = useState(true);

  const total = presentation.slides.length;
  const slide = presentation.slides[idx];

  const next = useCallback(() => setIdx((i) => Math.min(total - 1, i + 1)), [total]);
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Home') {
        setIdx(0);
      } else if (e.key === 'End') {
        setIdx(total - 1);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, prev, onClose, total]);

  // Hide page chrome (header, voice button, etc.) while presenting.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function handlePrint() {
    window.print();
  }

  if (!slide) {
    onClose();
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-bg flex flex-col print:hidden">
        {/* Top chrome bar */}
        <div
          className={clsx(
            'shrink-0 flex items-center justify-between px-4 py-2 border-b border-divider bg-surface transition-opacity',
            chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg truncate">{presentation.name}</p>
            <p className="text-xs text-fg-faint">Slide {idx + 1} of {total} · {presentation.targetAudience}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-fg-muted border border-divider rounded-lg hover:bg-bg hover:text-fg"
              title="Save deck as PDF via browser print"
            >
              <Printer size={13} /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-fg-muted hover:bg-surface-1 hover:text-fg"
              title="Exit (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Slide area */}
        <div
          className="flex-1 min-h-0 flex items-center justify-center p-4 md:p-8 bg-bg relative"
          onMouseMove={() => setChromeVisible(true)}
        >
          {/* Tap zones — invisible buttons covering left + right halves for
              touch-first navigation while presenting on a phone/tablet. */}
          <button
            type="button"
            onClick={prev}
            className="absolute inset-y-0 left-0 w-1/3 z-10 focus:outline-none"
            aria-label="Previous slide"
          />
          <button
            type="button"
            onClick={next}
            className="absolute inset-y-0 right-0 w-1/3 z-10 focus:outline-none"
            aria-label="Next slide"
          />

          {/* Slide itself */}
          <div className="w-full h-full max-w-full max-h-full flex items-center justify-center">
            <div
              className="w-full"
              style={{ maxWidth: 'min(96vw, calc((100vh - 12rem) * 16 / 9))' }}
            >
              <SlideRenderer
                slide={slide}
                brochures={brochures}
                products={products}
                size="present"
                index={idx}
                total={total}
              />
            </div>
          </div>
        </div>

        {/* Bottom chrome bar */}
        <div
          className={clsx(
            'shrink-0 flex items-center justify-between px-4 py-2 border-t border-divider bg-surface transition-opacity',
            chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          <button
            onClick={prev}
            disabled={idx === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-fg-muted border border-divider rounded-lg hover:bg-bg hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Prev
          </button>

          {/* Slide nav strip */}
          <div className="hidden sm:flex items-center gap-1 overflow-x-auto max-w-[60%]">
            {presentation.slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={clsx(
                  'w-2 h-2 rounded-full shrink-0 transition-all',
                  i === idx ? 'bg-accent w-6' : 'bg-divider-strong hover:bg-fg-faint',
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={next}
            disabled={idx === total - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-fg-muted border border-divider rounded-lg hover:bg-bg hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Print-only layout — renders every slide stacked, one per page,
          landscape. The user hits Print → Save as PDF → done. */}
      <div className="hidden print:block">
        <style>{`
          @page { size: A4 landscape; margin: 0; }
          @media print {
            body { background: #fff; }
            .deck-print-slide {
              width: 100vw;
              height: 100vh;
              page-break-after: always;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0;
            }
            .deck-print-slide:last-child { page-break-after: auto; }
          }
        `}</style>
        {presentation.slides.map((s, i) => (
          <div key={s.id} className="deck-print-slide">
            <div style={{ width: '90%', maxWidth: 1200 }}>
              <SlideRenderer
                slide={s}
                brochures={brochures}
                products={products}
                size="present"
                index={i}
                total={total}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
