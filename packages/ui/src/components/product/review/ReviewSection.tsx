'use client';
import React, { useState, useEffect } from 'react';
import ReviewForm, { NewReview } from './ReviewForm';
import ReviewList from './ReviewList';

interface ReviewsSectionProps {
  productId: string;
}
import { useUser } from '@acme/core/contexts/UserContext';
import { ProductReview } from '@acme/core/types';

export default function ReviewsSection({ productId }: ReviewsSectionProps) {
  const { user } = useUser(); // get current user
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  useEffect(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data: ProductReview[]) => {
        setReviews(data);
      })
      .catch(() => {
        setReviews([]);
      });
  }, [productId]);

  const handleNewReview = (newReview: NewReview) => {
    if (!user?.id) return;
    fetch(`/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newReview, userId: user.id }),
    })
      .then((res) => res.json())
      .then((saved: ProductReview) => setReviews((prev) => [saved, ...prev]))
      .catch(() => console.error('Failed to post review'));
  };

  const handleDelete = (reviewId: string) => {
    if (!user?.id) return;

    fetch(`/api/products/${productId}/reviews`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId, userId: user.id }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to delete');
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      })
      .catch(() => console.error('Failed to delete review'));
  };

  return (
    <section className="max-w-3xl mx-auto my-12 space-y-8">
      <h2 className="text-2xl font-bold">Customer Reviews</h2>
      <ReviewList reviews={reviews} currentUserId={user?.id} onDelete={handleDelete} />
      <ReviewForm productId={productId} onSubmit={handleNewReview} />
    </section>
  );
}
