// src/components/ArtPlacerWidget.tsx
"use client";

import React, { useEffect } from "react";

declare global {
  interface Window {
    ArtPlacer?: any;
  }
}

interface ArtPlacerProps {
  galleryId: string;
}

export default function ArtPlacerWidget({ galleryId }: ArtPlacerProps) {
  useEffect(() => {
    // load the script dynamically
    const script = document.createElement("script");
    script.src = "https://widget.artplacer.com/js/script.js";
    script.async = true;
    script.onload = () => {
      if (window.ArtPlacer) {
        window.ArtPlacer.insert({
          gallery: galleryId,
          default_style: "true",
          resizable: "false",
          frames: "true",
          rotate: "false",
          catalog: "visible",
          type: "1",
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [galleryId]);

  return <div id="artplacer-widget" />;
}
