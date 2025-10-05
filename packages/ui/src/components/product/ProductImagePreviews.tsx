// src/components/product/ProductImagePreviews.tsx
'use client';
import Image from 'next/image';
import React from 'react';

interface PreviewProps {
  scenarios: string[];         // should be array of URLs, but could contain raw IDs
  selected: { src: string };   // your selected preview object
  onSelectAction: (src: { src: string, alt: string}) => void;
}

export default function ProductImagePreviews({
  scenarios,
  selected,
  onSelectAction,
}: PreviewProps) {
  return (
    <div className="flex flex-col gap-4">
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
            onClick={() => onSelectAction({ src: validSrc, alt: `Preview ${idx + 1}` })}
            className={`relative w-15 h-15 rounded-lg overflow-hidden border ${
              selected.src === validSrc ? 'ring-2 ring-purple-500' : 'ring-1 ring-gray-300'
            }`}
          >
            <Image
              src={validSrc}
              alt={`Preview ${idx + 1}`}
              fill
              className="object-cover"
            />
          </button>
        );
      })}
    </div>
  );
}
