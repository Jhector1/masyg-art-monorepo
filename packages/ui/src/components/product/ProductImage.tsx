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
  const [failedSource, setFailedSource] = useState<string | null>(null);
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

  const imageFailed = failedSource === imageSrc;
  const handleOpenZoom = () => { if (!imageFailed) setZoomImage({ src: imageSrc, title: alt }); };
  const handleCloseZoom = () => setZoomImage(null);

  return (
    <>
      {/* small screens: fixed 300×300 (or whatever) */}
      <div
        className="block lg:hidden relative shadow-lg overflow-hidden bg-gray-50 mb-4 cursor-zoom-in"
        onClick={handleOpenZoom}
      >    
                          {/* <span className="absolute left-2 top-2 z-10 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-medium text-white">
                            Customized
                          </span>
                    */}
        {imageFailed ? (
          <div role="status" className="grid min-h-64 place-items-center p-6 text-center text-sm text-neutral-500">
            This artwork preview could not be loaded.
          </div>
        ) : <Image
          {...imgProps}
          src={imageSrc}
          alt={alt}
          onError={(event) => { setFailedSource(imageSrc); imgProps.onError?.(event); }}
          // these define the intrinsic aspect ratio (you can pick any numbers
          // that match your image’s native ratio)
          width={700}
          height={475}
          // override the actual rendered size
          style={{ width: "100%", height: "auto" }}
          className={`object-contain relative  p-4 ${className ?? ""}`}
        />}
      </div>

      {/* lg+ screens: full-width, 80vh height, with fill */}
      <div
        className="hidden lg:inline-block relative w-full h-[min(72vh,780px)] shadow-lg overflow-hidden bg-gray-50 mb-0 cursor-zoom-in"
        onClick={handleOpenZoom}
      >
        {imageFailed ? (
          <div role="status" className="grid h-full place-items-center p-6 text-center text-sm text-neutral-500">
            This artwork preview could not be loaded.
          </div>
        ) : <Image
          {...imgProps}
          src={imageSrc}
          alt={alt}
          onError={(event) => { setFailedSource(imageSrc); imgProps.onError?.(event); }}
          fill
          className={`object-contain object-center ${className ?? ""}`}
        />}
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
