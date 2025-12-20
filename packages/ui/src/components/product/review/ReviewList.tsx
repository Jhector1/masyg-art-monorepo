"use client";

import RatingStars from "./RatingStars";
import type { ProductReviewDTO } from "@acme/core/utils/reviewsClient";

interface ReviewListProps {
  reviews: ProductReviewDTO[];
  currentUserId?: string;
  onDelete?: (reviewId: string) => void;
}

export default function ReviewList({ reviews, currentUserId, onDelete }: ReviewListProps) {
  if (!reviews.length) {
    return <p className="text-gray-500">No reviews yet. Be the first to review!</p>;
  }

  return (
    <ul className="space-y-6">
      {reviews.map((rev) => (
        <li key={rev.id} className="border-b pb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">{rev.user || "Anonymous"}</span>
            <span className="text-sm text-gray-500">
              {rev.date || new Date(rev.createdAt).toLocaleDateString()}
            </span>
          </div>

          <RatingStars rating={rev.rating} />
          <p className="mt-2 text-gray-700">{rev.text}</p>

          {currentUserId === rev.userId && (
            <button
              onClick={() => onDelete?.(rev.id)}
              className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:underline"
              aria-label="Delete review"
              type="button"
            >
              🗑️ Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
