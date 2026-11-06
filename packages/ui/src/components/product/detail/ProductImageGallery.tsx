// File: src/components/product/detail/ProductImageGallery.tsx
import ProductImage from "../ProductImage";
import ProductImagePreviews from "../ProductImagePreviews";
import ImageSlider from "../ImageSlider";
import React from "react";

interface Props {
  product: { thumbnails: string[] };
  preview: { src: string; alt: string } | null;
  setPreview: (preview: { src: string; alt: string } | null) => void;
}

/**
 * Reuse the historical ZileDigital gallery. A public-media URL redirects to a
 * verified public preview object; the browser may load that redirect directly.
 * Next's optimizer is intentionally bypassed only for those scoped URLs.
 * This does not grant access to private download objects.
 */
function isPublishedPreviewPath(path: string): boolean {
  return /^\/api\/public\/stores\/[A-Za-z0-9_-]+\/media\/[A-Za-z0-9_-]+$/.test(path);
}

export default function ProductImageGallery({ product, preview, setPreview }: Props) {
  const directMedia = product.thumbnails.length > 0 && product.thumbnails.every(isPublishedPreviewPath);
  return (
    <>
      <div className="hidden sm:flex w-full min-w-0 items-start gap-3 lg:gap-4 lg:sticky lg:top-24 lg:self-start">
        <ProductImagePreviews
          scenarios={product.thumbnails}
          onSelectAction={setPreview}
          selected={{ src: preview?.src || "" }}
          unoptimized={directMedia}
        />
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-black/5">
          <ProductImage
            src={preview?.src || ""}
            alt={preview?.alt || "Artwork preview"}
            unoptimized={directMedia}
          />
        </div>
      </div>
      <div className="block min-w-0 sm:hidden">
        <ImageSlider images={product.thumbnails} unoptimized={directMedia} />
      </div>
    </>
  );
}
