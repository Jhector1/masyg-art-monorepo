'use client';

import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import './artworkFrameSquare.css';

export interface ArtworkFrameSquareProps {
  imageSrc: string;
  width?: number;
  frameColor?: string;
  frameWidth?: number;
  linerColor?: string;
  linerWidth?: number;
  matteColor?: string;
  mattePadding?: number;
}

export function ArtworkFrameSquare({
  imageSrc,
  width = 600, // default max width
  frameColor = '#000',
  frameWidth = 20,
  linerColor = '#D4AF37',
  linerWidth = 4,
  matteColor = '#fff',
  mattePadding = 60,
}: ArtworkFrameSquareProps) {
  const [ratio, setRatio] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  // Load image to determine aspect ratio
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => setRatio(img.naturalHeight / img.naturalWidth);
  }, [imageSrc]);

  const computedWidth = width;
  const computedHeight = width * ratio;

  // 3D tilt mouse tracking
  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const { left, top, width: w, height: h } = svgRef.current.getBoundingClientRect();
    const lx = ((e.clientX - left) / w) * 100;
    const ly = ((e.clientY - top) / h) * 100;
    svgRef.current.style.setProperty('--lx', `${lx}`);
    svgRef.current.style.setProperty('--ly', `${ly}`);
  };

  const innerTotal = frameWidth + linerWidth + mattePadding;
  const innerW = computedWidth - 2 * innerTotal;
  const innerH = computedHeight - 2 * innerTotal;

  return (
    <div className="w-full flex justify-center">
      <svg
        ref={svgRef}
        className="artwork-frame-square w-full max-w-[90vw] sm:max-w-[600px] h-auto"
        viewBox={`0 0 ${computedWidth} ${computedHeight}`}
        onMouseMove={handleMouseMove}
        onClick={() => svgRef.current?.classList.toggle('open')}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="frameShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.4" />
          </filter>
          <clipPath id="squareClip">
            <rect x={innerTotal} y={innerTotal} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* Outer Frame */}
        <rect
          x={frameWidth / 2}
          y={frameWidth / 2}
          width={computedWidth - frameWidth}
          height={computedHeight - frameWidth}
          fill="none"
          stroke={frameColor}
          strokeWidth={frameWidth}
          filter="url(#frameShadow)"
        />

        {/* Liner */}
        {frameColor !== '#000' && (
          <rect
            x={frameWidth + linerWidth / 2}
            y={frameWidth + linerWidth / 2}
            width={computedWidth - 2 * frameWidth - linerWidth}
            height={computedHeight - 2 * frameWidth - linerWidth}
            fill="none"
            stroke={linerColor}
            strokeWidth={linerWidth}
          />
        )}

        {/* Mat Board */}
        <rect
          x={innerTotal}
          y={innerTotal}
          width={innerW}
          height={innerH}
          fill={matteColor}
        />

        {/* Artwork */}
        <g clipPath="url(#squareClip)">
          <image
            href={imageSrc}
            x={innerTotal}
            y={innerTotal}
            width={innerW}
            height={innerH}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
      </svg>
    </div>
  );
}
