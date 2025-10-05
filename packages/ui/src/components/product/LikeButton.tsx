

// File: components/LikeButton.tsx
'use client';
import React from 'react';
export default function LikeButton({
  liked,
  onToggle,
}: {
  liked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="text-3xl transition-transform hover:scale-110"
    >
      {liked ? '❤️' : '🤍'}
    </button>
  );
}