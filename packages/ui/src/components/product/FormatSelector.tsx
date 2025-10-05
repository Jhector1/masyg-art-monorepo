'use client';
import { CartSelectedItem, CartUpdates, Format } from '@acme/core/types';
import React from 'react';

export default function FormatSelector({
  formats,
  selected,
  onChangeAction,
  updateCart,
  inCart,
}: {
  formats: Format[];
  selected: string;
  updateCart: (updates: CartUpdates) => void;
  inCart: CartSelectedItem | null;
  onChangeAction: (f: string) => void;
}) {
  return (
    <fieldset className="w-full">
      <legend className="block font-semibold mb-2">All Format Included</legend>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {formats.map((f) => {
          const id = `format-${f.type}`;
          return (
             f.type.length<5 && <label
              key={f.type + f.resolution}
              htmlFor={id}
              className={[
                'flex items-center gap-2 cupointerrsor- rounded-lg border px-3 py-2',
                selected === f.type
                  ? 'border-purple-600 ring-2 ring-purple-200 bg-purple-50':'border-purple-600 ring-2 ring-purple-200 bg-purple-50'
                  // : 'border-gray-300 hover:border-gray-400',
              ].join(' ')}
            >
              <input
              disabled={true}
                id={id}
                type="radio"
                name="format"
                value={f.type}
                className="sr-only"
                checked={selected === f.type}
                onChange={() => {
                  onChangeAction(f.type);
                  if (inCart) updateCart({ format: f.type });
                }}
              />
              <span className="text-sm">
                {f.type.toUpperCase()} <span className="text-gray-500">({f.resolution})</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
