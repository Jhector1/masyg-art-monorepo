// src/utils/fetchProducts.ts

import { ProductListItem } from "../types";

export async function fetchProducts(): Promise<ProductListItem[]> {
  const res = await fetch("/api/products?type=DIGITAL&PRINT");
  if (!res.ok) throw new Error(`could not fetch products: ${res.status}`);
  return res.json();
}
