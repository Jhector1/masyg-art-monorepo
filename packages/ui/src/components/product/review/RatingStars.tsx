// File: components/RatingStars.tsx
'use client';
import React from 'react';

type RatingStarsProps = {
  rating: number;
  editable?: boolean;
  onChange?: (rating: number) => void;
};

export default function RatingStars({ rating, editable = false, onChange }: RatingStarsProps) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => editable && onChange?.(star)}
          className="text-xl transition-colors focus:outline-none"
          aria-label={`${star} star`}
        >
          <span className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  );
}