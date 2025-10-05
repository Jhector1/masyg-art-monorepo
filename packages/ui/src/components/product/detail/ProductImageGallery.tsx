// File: src/components/product/detail/ProductImageGallery.tsx
import ProductImage from "../ProductImage";
import ProductImagePreviews from "../ProductImagePreviews";
import ImageSlider from "../ImageSlider";
// import { Product } from "@prisma/client";
import React from "react";
import { ProductDetailResult } from "@acme/core/types";

interface Props {
  product: ProductDetailResult;
  preview: { src: string; alt: string } | null;
  setPreview: (preview: { src: string; alt: string } | null) => void;
}

export default function ProductImageGallery({
  product,
  preview,
  setPreview,
}: Props) {
  return (
    <>
      <div className="hidden sm:flex gap-5 lg:sticky top-5 lg:h-screen lg:justify-between">
        <ProductImagePreviews
          scenarios={product.thumbnails}
          onSelectAction={setPreview}
          selected={{ src: preview?.src || "" }}
        />
        <div className="w-[50vw] lg:h-screen">
        
          <ProductImage src={preview?.src || ""} alt={preview?.alt || ""} />
        </div>
      </div>
      <div className="block sm:hidden">
        <ImageSlider images={product.thumbnails} />
      </div>
    </>
  );
}
