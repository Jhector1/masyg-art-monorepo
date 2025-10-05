// File: components/ReviewForm.tsx
'use client';
import React, { useState } from 'react';
import RatingStars from './RatingStars';
import UniversalModal from '../../modal/UniversalModal';
import AuthenticationForm from '../../authenticate/AuthenticationFom';
import { useUser } from '@acme/core/contexts/UserContext';

export interface NewReview {
  rating: number;
  text: string;
}

interface ReviewFormProps {
  productId: string;
  onSubmit: (review: NewReview) => void;
}
export default function ReviewForm({ onSubmit }: ReviewFormProps) {
  const [rating, setRating]   = useState(0);
  const [text,   setText]     = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const { isLoggedIn }        = useUser();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();                // always first!
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    if (rating && text.trim()) {
      onSubmit({ rating, text: text.trim() });
      setRating(0);
      setText('');
    }
  };

  return (
    <>
      {/*  ⬅ modal is *outside* the form, rendered through a portal */}
      <UniversalModal isOpen={showAuth} onClose={() => setShowAuth(false)}>
        <AuthenticationForm />
      </UniversalModal>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white p-6 rounded-lg shadow"
      >
        <h3 className="text-lg font-semibold">Leave a Review</h3>

        <label className="block font-medium mb-1">Your Rating:</label>
        <RatingStars rating={rating} editable onChange={setRating} />

        <label className="block font-medium mb-1">Your Review:</label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full border rounded p-2"
          placeholder="Write your thoughts…"
        />

        <button
          type="submit"
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
        >
          Submit Review
        </button>
      </form>
    </>
  );
}
