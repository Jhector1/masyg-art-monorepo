import { ProductReview } from "@acme/core/types";
import RatingStars from "./RatingStars";



interface ReviewListProps {
  reviews: ProductReview[];
  currentUserId?: string;
  onDelete?: (reviewId: string) => void;
}

export default function ReviewList({ reviews, currentUserId, onDelete }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-gray-500">No reviews yet. Be the first to review!</p>;
  }

  return (
    <ul className="space-y-6">
      {reviews.map((rev) => (
        <li key={rev.id} className="border-b pb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">{rev?.user?.name||'Anonymous'}</span>
            <span className="text-sm text-gray-500">
              {new Date(rev.createdAt).toLocaleDateString()}
            </span>
          </div>
          <RatingStars rating={rev.rating} />
          <p className="mt-2 text-gray-700">{rev.comment}</p>

          {currentUserId === rev.userId && (
            <button
              onClick={() => onDelete?.(rev.id)}
              className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1"
              aria-label="Delete review"
            >
              🗑️ Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
