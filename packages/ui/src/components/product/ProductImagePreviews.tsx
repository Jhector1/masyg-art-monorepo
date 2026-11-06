// src/components/product/ProductImagePreviews.tsx
'use client';
import Image from 'next/image';
import React, { useState } from 'react';

interface PreviewProps {
  scenarios: string[];         // should be array of URLs, but could contain raw IDs
  selected: { src: string };   // your selected preview object
  onSelectAction: (src: { src: string, alt: string}) => void;
  unoptimized?: boolean;
}

export default function ProductImagePreviews({
  scenarios,
  selected,
  onSelectAction,
  unoptimized = false,
}: PreviewProps) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  return (
    <div className="flex shrink-0 flex-col gap-3" aria-label="Artwork previews">
      {scenarios.map((s, idx) => {
        // Try to parse s as a URL. If it fails, fall back to a placeholder.
        const validSrc = (() => {
          try {
            return new URL(s).toString();
          } catch {
            // if it's already a local path, keep it; otherwise placeholder
            return s.startsWith('/') ? s : '/placeholder.png';
          }
        })();

        return (
          <button
            key={idx}
            type="button"
            aria-label={`Show artwork preview ${idx + 1}`}
            aria-pressed={selected.src === validSrc}
            onClick={() => onSelectAction({ src: validSrc, alt: `Preview ${idx + 1}` })}
            className={`relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg overflow-hidden border bg-neutral-100 ${
              selected.src === validSrc ? 'ring-2 ring-purple-500' : 'ring-1 ring-gray-300'
            }`}
          >
            {failed[validSrc] ? (
              <span className="grid h-full w-full place-items-center p-1 text-center text-[9px] leading-tight text-neutral-500">Image unavailable</span>
            ) : (
              <Image
                src={validSrc}
                alt={`Preview ${idx + 1}`}
                fill
                sizes="64px"
                unoptimized={unoptimized}
                onError={() => setFailed(prev => ({ ...prev, [validSrc]: true }))}
                className="object-cover"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
