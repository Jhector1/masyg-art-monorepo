// File: packages/core/src/utils/reviewsClient.ts
export type ProductReviewDTO = {
  id: string;
  userId: string;
  user: string;      // name/email fallback
  rating: number;    // 1..5
  text: string;      // comment
  date: string;      // YYYY-MM-DD
  createdAt: string; // ISO
};

type FetchOpts = {
  signal?: AbortSignal;
};

async function readError(res: Response) {
  // Try json first, then text
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const j = await res.json().catch(() => null);
    if (j?.error) return String(j.error);
    return JSON.stringify(j ?? {});
  }
  return await res.text().catch(() => "Request failed");
}

export async function getProductReviews(
  productId: string,
  opts: FetchOpts = {}
): Promise<ProductReviewDTO[]> {
  if (!productId) throw new Error("Missing productId");

  const res = await fetch(`/api/public/products/${productId}/reviews`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    signal: opts.signal,
  });

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ProductReviewDTO[];
}

export async function addProductReview(
  productId: string,
  args: { rating: number; text: string },
  opts: FetchOpts = {}
): Promise<ProductReviewDTO> {
  if (!productId) throw new Error("Missing productId");

  const res = await fetch(`/api/user/products/${productId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    signal: opts.signal,
    body: JSON.stringify({
      rating: args.rating,
      text: args.text,
    }),
  });

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ProductReviewDTO;
}

export async function deleteProductReview(
  productId: string,
  reviewId: string,
  opts: FetchOpts = {}
): Promise<{ success: true }> {
  if (!productId) throw new Error("Missing productId");
  if (!reviewId) throw new Error("Missing reviewId");

  const res = await fetch(`/api/user/products/${productId}/reviews`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    signal: opts.signal,
    body: JSON.stringify({ reviewId }),
  });

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { success: true };
}
