// File: packages/server/src/services/reviews.service.ts
import { prisma } from "@acme/core/lib/prisma";

export type ProductReviewDTO = {
  id: string;
  userId: string;
  user: string;      // name/email fallback
  rating: number;
  text: string;      // maps from Review.comment
  date: string;      // YYYY-MM-DD
  createdAt: string; // ISO
};

function toDTO(r: any): ProductReviewDTO {
  return {
    id: r.id,
    userId: r.userId,
    user: r.user?.name ?? r.user?.email ?? "Unknown user",
    rating: Number(r.rating) || 0,
    text: r.comment ?? "",
    date: new Date(r.createdAt).toISOString().split("T")[0],
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

function clampRating(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const rounded = Math.round(v);
  return Math.max(1, Math.min(5, rounded));
}

export const reviewsService = {
  async listByProduct(productId: string): Promise<ProductReviewDTO[]> {
    if (!productId) throw new Error("Missing productId");

    const reviews = await prisma.review.findMany({
      where: { productId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return reviews.map(toDTO);
  },

  async create(args: {
    productId: string;
    userId: string;
    rating: number;
    text: string;
  }): Promise<ProductReviewDTO> {
    const { productId, userId, rating, text } = args;

    if (!productId) throw new Error("Missing productId");
    if (!userId) throw new Error("Missing userId");

    const safeRating = clampRating(rating);
    if (safeRating == null) throw new Error("Invalid rating (must be 1-5)");

    const comment = String(text ?? "").trim();
    if (!comment) throw new Error("Missing rating or comment text");

    const created = await prisma.review.create({
      data: {
        productId,
        userId,
        rating: safeRating,
        comment,
      },
      include: { user: true },
    });

    return toDTO(created);
  },

  async deleteOwn(args: { reviewId: string; userId: string }): Promise<{ success: true }> {
    const { reviewId, userId } = args;

    if (!userId) throw new Error("Missing userId");
    if (!reviewId) throw new Error("Missing reviewId");

    const review = await prisma.review.findUnique({ where: { id: reviewId } });

    if (!review) throw new Error("Review not found");
    if (review.userId !== userId) throw new Error("Unauthorized");

    await prisma.review.delete({ where: { id: reviewId } });
    return { success: true };
  },
};
