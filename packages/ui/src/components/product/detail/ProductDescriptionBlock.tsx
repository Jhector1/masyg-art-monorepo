// File: src/components/product/detail/ProductDescriptionBlock.tsx
import React from "react";
import { ProductDetailResult } from "@acme/core/types";

export default function ProductDescriptionBlock({ product }: { product: ProductDetailResult }) {
  return (
    <>
      <h1 className="text-3xl font-bold">{product.title}</h1>
      <h3 className="font-bold">Description:</h3>
      <p className="pb-10">{product.description}</p>
    </>
  );
}