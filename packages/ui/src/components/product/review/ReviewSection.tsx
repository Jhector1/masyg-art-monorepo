"use client";

import React, { useEffect, useState, useCallback } from "react";
import ReviewForm, { NewReview } from "./ReviewForm";
import ReviewList from "./ReviewList";
import { useUser } from "@acme/core/contexts/UserContext";

import type { ProductReviewDTO } from "@acme/core/utils/reviewsClient";
import {
  getProductReviews,
  addProductReview,
  deleteProductReview,
} from "@acme/core/utils/reviewsClient";

interface ReviewsSectionProps {
  productId: string;
}

export default function ReviewsSection({ productId }: ReviewsSectionProps) {
  const { user, isLoggedIn } = useUser();
  const [reviews, setReviews] = useState<ProductReviewDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const rs = await getProductReviews(productId);
      setReviews(rs);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNewReview = async (newReview: NewReview) => {
    if (!isLoggedIn) return; // your ReviewForm already handles auth modal too

    try {
      const created = await addProductReview(productId, {
        rating: newReview.rating,
        text: newReview.text,
      });
      setReviews((prev) => [created, ...prev]);
    } catch (e) {
      console.error("Failed to post review", e);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!isLoggedIn) return;

    try {
      await deleteProductReview(productId, reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch (e) {
      console.error("Failed to delete review", e);
    }
  };

  return (
    <section className="mx-auto my-12 max-w-3xl space-y-8">
      <h2 className="text-2xl font-bold">Customer Reviews</h2>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading reviews…</p>
      ) : (
        <ReviewList
          reviews={reviews}
          currentUserId={user?.id}
          onDelete={handleDelete}
        />
      )}

      <ReviewForm productId={productId} onSubmit={handleNewReview} />
    </section>
  );
}
