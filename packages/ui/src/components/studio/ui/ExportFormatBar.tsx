// ExportFormatBar.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

type ExportFormat = 'png' | 'jpg' | 'webp' | 'tiff' | 'svg';

export default function ExportFormatBar({
  formats,
  canExport,
  exporting,   // kept for backwards compatibility (global busy)
  loading,     // kept for backwards compatibility (global busy)
  exportsLeft,
  purchased,
  purchasedDigital,
  onExport,
}: {
  formats: ExportFormat[];
  canExport: boolean;
  exporting: boolean;
  loading: boolean;
  purchased: boolean;
  purchasedDigital:boolean;
  exportsLeft: number;
  onExport: (fmt: ExportFormat) => void | Promise<void>; // 👈 allow async
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // local per-button loading
  const [activeFmt, setActiveFmt] = useState<ExportFormat | null>(null);
  const localBusy = activeFmt !== null;

  const updateEdges = () => {
    const el = wrapRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setAtStart(scrollLeft <= 1);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 1);
  };

  useEffect(() => {
    mountedRef.current = true;
    updateEdges();
    const el = wrapRef.current;
    if (!el) return;

    const onResize = () => updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      mountedRef.current = false;
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // If parent toggles global flags off, clear local spinner just in case
  useEffect(() => {
    if (!exporting && !loading && activeFmt !== null) {
      setActiveFmt(null);
    }
  }, [exporting, loading, activeFmt]);

  const nudge = (dir: 1 | -1) => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.6), behavior: 'smooth' });
  };

  const handleExport = async (fmt: ExportFormat) => {
    if (!canExport || exporting || loading || localBusy) return;
    setActiveFmt(fmt);

    try {
      const maybePromise = onExport(fmt);
      if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
        await (maybePromise as Promise<void>);
      }
    } finally {
      // guard against setState on unmounted
      if (mountedRef.current) setActiveFmt(null);
    }
  };

  const globallyDisabled = !canExport || exporting || loading || localBusy;
// alert(purchasedDigital)
  return (
    <div className="relative w-full sm:w-auto rounded-xl ring-1 ring-black/10 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="text-xs">
          {canExport ? (
            <span className="text-emerald-700">Exports left: {exportsLeft}</span>
          ) : (
            <span className="text-amber-700">{!purchased ?'Purchase to export': 'Out of export'}</span>
          )}
        </div>
        {/* Live region for screen readers when an export starts */}
        <span className="sr-only" aria-live="polite">
          {activeFmt ? `Exporting ${activeFmt.toUpperCase()}…` : ''}
        </span>
      </div>

      <div className="relative">
        {/* Scrollable pill row */}
        <div
          ref={wrapRef}
          className="
            flex gap-2 px-2 pb-2 overflow-x-auto scroll-smooth
            flex-nowrap
            [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden
          "
          aria-label="Export formats"
        >
          {formats.map((fmt) => {
            const isActive = activeFmt === fmt;
            const disabled = globallyDisabled && !isActive; // keep the active one visually busy
            return (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={disabled || !canExport || !purchasedDigital}
                aria-busy={isActive}
                className={[
                  'shrink-0 snap-start rounded-lg px-3 py-2 text-xs font-medium min-w-[72px] transition',
                  !canExport || disabled||!purchasedDigital ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-50',
                  isActive ? 'ring-2 ring-emerald-300 bg-emerald-50' : 'ring-1 ring-black/5',
                ].join(' ')}
                title={canExport ? `Export as ${fmt.toUpperCase()}` : 'Export blocked'}
              >
                {isActive ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    Preparing…
                  </span>
                ) : (
                  fmt.toUpperCase()
                )}
              </button>
            );
          })}
        </div>

        {/* Edge shadows */}
        {!atStart && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent rounded-l-xl" />
        )}
        {!atEnd && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent rounded-r-xl" />
        )}

        {/* Nudge chevrons (appear only when needed) */}
        {!atStart && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 ring-1 ring-black/10 grid place-items-center shadow-sm"
            aria-label="Scroll formats left"
          >
            ‹
          </button>
        )}
        {!atEnd && (
          <button
            type="button"
            onClick={() => nudge(1)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 ring-1 ring-black/10 grid place-items-center shadow-sm"
            aria-label="Scroll formats right"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}
