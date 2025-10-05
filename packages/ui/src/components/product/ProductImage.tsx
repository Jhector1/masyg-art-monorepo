"use client";

import Image, { type ImageProps, type StaticImageData } from "next/image";
import React, { useState } from "react";
import ImageModal from "../store/ImageModal";

interface ProductImageProps extends Omit<ImageProps, "src" | "alt"> {
  src: string | StaticImageData;
  alt: string;
  className?: string;
}

export default function ProductImage({
  src,
  alt,
  className,
  ...imgProps
}: ProductImageProps) {
  const [zoomImage, setZoomImage] = useState<{
    src: string;
    title: string;
  } | null>(null);

  let imageSrc: string;
  if (typeof src === "string") {
    try {
      imageSrc = new URL(src).toString();
    } catch {
      imageSrc = src.startsWith("/") ? src : "/placeholder.png";
    }
  } else {
    imageSrc = src.src;
  }

  const handleOpenZoom = () => setZoomImage({ src: imageSrc, title: alt });
  const handleCloseZoom = () => setZoomImage(null);

  return (
    <>
      {/* small screens: fixed 300×300 (or whatever) */}
      <div
        className="block lg:hidden relative shadow-lg overflow-hidden bg-gray-50 mb-10 cursor-zoom-in"
        onClick={handleOpenZoom}
      >    
                          {/* <span className="absolute left-2 top-2 z-10 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-medium text-white">
                            Customized
                          </span>
                    */}
        <Image
          {...imgProps}
          src={imageSrc}
          alt={alt}
          // these define the intrinsic aspect ratio (you can pick any numbers
          // that match your image’s native ratio)
          width={700}
          height={475}
          // override the actual rendered size
          style={{ width: "100%", height: "auto" }}
          className={`object-contain relative  p-4 ${className ?? ""}`}
        />
      </div>

      {/* lg+ screens: full-width, 80vh height, with fill */}
      <div
        className="hidden lg:inline-block relative w-full h-[80vh] shadonw-lg overflow-hidden bg-grhay-50 mb-10 cursor-zoom-in"
        onClick={handleOpenZoom}
      >
        <Image
          {...imgProps}
          src={imageSrc}
          alt={alt}
          fill
          className={`object-contain object-top  ${className ?? ""}`}
        />
      </div>

      {zoomImage && (
        <ImageModal
          image={zoomImage.src}
          title={zoomImage.title}
          isOpen
          onClose={handleCloseZoom}
        />
      )}
    </>
  );
}
