"use client";

import React, { useState } from "react";
import RatingStars from "./RatingStars";
import UniversalModal from "../../modal/UniversalModal";
import AuthenticationForm from "../../authenticate/AuthenticationFom";
import { useUser } from "@acme/core/contexts/UserContext";

export interface NewReview {
  rating: number;
  text: string;
}

interface ReviewFormProps {
  productId: string;
  onSubmit: (review: NewReview) => void;
}

export default function ReviewForm({ onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const { isLoggedIn } = useUser();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    if (rating && text.trim()) {
      onSubmit({ rating, text: text.trim() });
      setRating(0);
      setText("");
    }
  };

  return (
    <>
      <UniversalModal isOpen={showAuth} onClose={() => setShowAuth(false)}>
        <AuthenticationForm />
      </UniversalModal>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <h3 className="text-lg font-semibold">Leave a Review</h3>

        <label className="mb-1 block font-medium">Your Rating:</label>
        <RatingStars rating={rating} editable onChange={setRating} />

        <label className="mb-1 block font-medium">Your Review:</label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded border p-2"
          placeholder="Write your thoughts…"
        />

        <button
          type="submit"
          className="rounded bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
        >
          Submit Review
        </button>
      </form>
    </>
  );
}
