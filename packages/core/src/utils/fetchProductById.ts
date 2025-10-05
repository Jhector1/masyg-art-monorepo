// src/utils/api.ts

// import { ApiProduct } from "@/types";
import {  ProductDetailResult } from "../types";
// import { Product } from "@prisma/client";


/**
 * Fetch one product from `/api/products/[id]`.
 */
export async function fetchProductById(productId: string, userId: string): Promise<ProductDetailResult> {
  const res = await fetch(`/api/products/${productId}?userId=${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    // no-store forces always-fresh data; remove if you want ISR/caching
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to load product ${productId}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
