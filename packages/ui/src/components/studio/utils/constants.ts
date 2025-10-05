// ───────────────────────────────────────────────────────────
// file: src/components/editor/constants.ts
// ───────────────────────────────────────────────────────────
import type { StyleState, GradientDef } from "../types";

export const DEFAULT_STYLE: StyleState = {
  fillColor: "#ffffffff",
  strokeColor: "#000000",
  strokeWidth: 2,
  backgroundColor: "#ffffff",
};

export const SOLIDS: string[] = [
  "#000000",
  "#ffffff",
  "#f2f2f2",
  "#222222",
  "#0055A4",
  "#EF3340",
  "#FFD700",
  "#00B894",
  "#1B9CFC",
  "#8E44AD",
  "#E67E22",
  "#2ECC71",
  "#C0392B",
  "#34495E",
];
type GridOption = { id: string; label: string; fill: string; previewBg?: string };

export const GRID_OPTIONS: GridOption[] = [
  { id: "grid-neon-16",        label: "Neon Night (16)",       fill: "url(#grid-neon-16)",        previewBg: "#0B0B10" },
  { id: "grid-royal-gold-20",  label: "Royal Gold (20)",       fill: "url(#grid-royal-gold-20)",  previewBg: "#1D1753" },
  { id: "grid-karayib-24",     label: "Karayib Breeze (24)",   fill: "url(#grid-karayib-24)",     previewBg: "#061B2A" },
  { id: "grid-lilac-soft-18",  label: "Lilac Soft (18)",       fill: "url(#grid-lilac-soft-18)",  previewBg: "#FFFDF8" },
  { id: "grid-graphite-12",    label: "Graphite (12)",         fill: "url(#grid-graphite-12)",    previewBg: "#0D1117" },
  { id: "grid-mint-22",        label: "Mint Cream (22)",       fill: "url(#grid-mint-22)",        previewBg: "#F5FFF8" },
  { id: "grid-dots-cocoa-14",  label: "Dots — Cocoa (14)",     fill: "url(#grid-dots-cocoa-14)",  previewBg: "#FFF8F0" },
  { id: "grid-diamond-cyan-20",label: "Diamond Cyan (20)",     fill: "url(#grid-diamond-cyan-20)",previewBg: "#0B1530" },
];


export const EXTRA_GRADIENTS: GradientDef[] = [
  { id: "grad-miami-dream", from: "#4FACFE", to: "#00F2FE", angle: 25 },
  { id: "grad-cotton-candy", from: "#FFECD2", to: "#FCB69F", angle: 45 },
  { id: "grad-coral-reef", from: "#FF9966", to: "#FF5E62", angle: 20 },
  { id: "grad-mango-smoothie", from: "#FAD961", to: "#F76B1C", angle: 35 },
  { id: "grad-lilac-mist", from: "#A18CD1", to: "#FBC2EB", angle: 60 },
  { id: "grad-forest-breeze", from: "#0BAB64", to: "#3BB78F", angle: 90 },
  { id: "grad-deep-sea", from: "#2C3E50", to: "#4CA1AF", angle: 70 },
  { id: "grad-rose-gold", from: "#F4E2D8", to: "#BA5370", angle: 50 },
  { id: "grad-honey-lime", from: "#FBD786", to: "#C6FFDD", angle: 0 },
  { id: "grad-peach-garden", from: "#EECDA3", to: "#EF629F", angle: 30 },
  { id: "grad-plum-velvet", from: "#667EEA", to: "#764BA2", angle: 0 },
  { id: "grad-midnight", from: "#232526", to: "#414345", angle: 90 },
  { id: "grad-steel-sky", from: "#BDC3C7", to: "#2C3E50", angle: 90 },
  { id: "grad-sky-ice", from: "#56CCF2", to: "#2F80ED", angle: 30 },
  { id: "grad-inkblue", from: "#0F2027", to: "#2C5364", angle: 0 },
  { id: "grad-hibiscus", from: "#FF6F91", to: "#FFC75F", angle: 40 },
  { id: "grad-karayib", from: "#00D2FF", to: "#3A7BD5", angle: 60 },
  { id: "grad-bougainvillea", from: "#C33764", to: "#1D2671", angle: 35 },
  { id: "grad-terracotta", from: "#E07A5F", to: "#F2CC8F", angle: 25 },
  { id: "grad-olive-sage", from: "#DCE35B", to: "#45B649", angle: 75 },
  { id: "grad-moonlight", from: "#8E9EAB", to: "#EEF2F3", angle: 0 },
  { id: "grad-inkberry", from: "#1E3C72", to: "#2A5298", angle: 20 },
  { id: "grad-pearl-aqua", from: "#96DEDA", to: "#50C9C3", angle: 70 },
  { id: "grad-lava-glow", from: "#F12711", to: "#F5AF19", angle: 0 },
  { id: "grad-dragonfruit", from: "#F857A6", to: "#FF5858", angle: 30 },
  { id: "grad-jade-stream", from: "#00BF8F", to: "#30E8BF", angle: 75 },
  { id: "grad-mint-cream", from: "#D4FC79", to: "#96E6A1", angle: 0 },

  {
    id: "grad-aurora-veil",
    angle: 45,
    stops: [
      { offset: 0.0, color: "#0B132B" },
      { offset: 0.2, color: "#1C2541" },
      { offset: 0.45, color: "#3A506B" },
      { offset: 0.7, color: "#5BC0BE" },
      { offset: 1.0, color: "#C9F9FF" },
    ],
  },
  {
    id: "grad-neon-sunset",
    angle: 0,
    stops: [
      { offset: 0.0, color: "#12C2E9" },
      { offset: 0.5, color: "#C471ED" },
      { offset: 1.0, color: "#F64F59" },
    ],
  },
  {
    id: "grad-galaxy",
    angle: 45,
    stops: [
      { offset: 0.0, color: "#0F0C29" },
      { offset: 0.5, color: "#302B63" },
      { offset: 1.0, color: "#24243E" },
    ],
  },
  {
    id: "grad-miami-neon",
    angle: 35,
    stops: [
      { offset: 0.0, color: "#00DBDE" },
      { offset: 1.0, color: "#FC00FF" },
    ],
  },
  {
    id: "grad-celestial",
    angle: 45,
    stops: [
      { offset: 0.0, color: "#3A1C71" },
      { offset: 0.5, color: "#D76D77" },
      { offset: 1.0, color: "#FFAF7B" },
    ],
  },
];


export const GRADIENTS: GradientDef[] = [
  { id: "grad-sunrise", from: "#ff9a9e", to: "#fad0c4", angle: 45 },
  { id: "grad-lagon", from: "#00c6ff", to: "#0072ff", angle: 30 },
  { id: "grad-rouge", from: "#EF3340", to: "#FF6B6B", angle: 0 },
  { id: "grad-zile", from: "#00B894", to: "#1B9CFC", angle: 90 },
  {
    id: "grad-rainbow",
    angle: 0,
    stops: [
      { offset: 0.0, color: "#ef1f7e" },
      { offset: 0.08, color: "#f1425f" },
      { offset: 0.2, color: "#f57037" },
      { offset: 0.22, color: "#f67f32" },
      { offset: 0.32, color: "#f9b225" },
      { offset: 0.37, color: "#fbc620" },
      { offset: 0.55, color: "#8cc63e" },
      { offset: 0.75, color: "#00c6ff" },
      { offset: 1.0, color: "#5856D6" },
    ],
  },
  {
    id: "grad-trans",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#5BCEFA" },
      { offset: 0.2, color: "#5BCEFA" },
      { offset: 0.2, color: "#F5A9B8" },
      { offset: 0.4, color: "#F5A9B8" },
      { offset: 0.4, color: "#FFFFFF" },
      { offset: 0.6, color: "#FFFFFF" },
      { offset: 0.6, color: "#F5A9B8" },
      { offset: 0.8, color: "#F5A9B8" },
      { offset: 0.8, color: "#5BCEFA" },
      { offset: 1.0, color: "#5BCEFA" },
    ],
  },
  {
    id: "grad-nonbinary",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#FFF430" },
      { offset: 0.25, color: "#FFF430" },
      { offset: 0.25, color: "#FFFFFF" },
      { offset: 0.5, color: "#FFFFFF" },
      { offset: 0.5, color: "#9C59D1" },
      { offset: 0.75, color: "#9C59D1" },
      { offset: 0.75, color: "#000000" },
      { offset: 1.0, color: "#000000" },
    ],
  },
  {
    id: "grad-bi",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#D60270" },
      { offset: 0.4, color: "#D60270" },
      { offset: 0.4, color: "#9B4F96" },
      { offset: 0.6, color: "#9B4F96" },
      { offset: 0.6, color: "#0038A8" },
      { offset: 1.0, color: "#0038A8" },
    ],
  },
  {
    id: "grad-pan",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#FF1B8D" },
      { offset: 0.3333, color: "#FF1B8D" },
      { offset: 0.3333, color: "#FFD800" },
      { offset: 0.6667, color: "#FFD800" },
      { offset: 0.6667, color: "#1BB3FF" },
      { offset: 1.0, color: "#1BB3FF" },
    ],
  },
  {
    id: "grad-lesbian7",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#D52D00" },
      { offset: 0.1429, color: "#D52D00" },
      { offset: 0.1429, color: "#EF7627" },
      { offset: 0.2857, color: "#EF7627" },
      { offset: 0.2857, color: "#FF9A56" },
      { offset: 0.4286, color: "#FF9A56" },
      { offset: 0.4286, color: "#FFFFFF" },
      { offset: 0.5714, color: "#FFFFFF" },
      { offset: 0.5714, color: "#D162A4" },
      { offset: 0.7143, color: "#D162A4" },
      { offset: 0.7143, color: "#B55690" },
      { offset: 0.8571, color: "#B55690" },
      { offset: 0.8571, color: "#A30262" },
      { offset: 1.0, color: "#A30262" },
    ],
  },
  {
    id: "grad-ace",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#000000" },
      { offset: 0.25, color: "#000000" },
      { offset: 0.25, color: "#A4A4A4" },
      { offset: 0.5, color: "#A4A4A4" },
      { offset: 0.5, color: "#FFFFFF" },
      { offset: 0.75, color: "#FFFFFF" },
      { offset: 0.75, color: "#800080" },
      { offset: 1.0, color: "#800080" },
    ],
  },
  {
    id: "grad-genderfluid",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#FF75A2" },
      { offset: 0.2, color: "#FF75A2" },
      { offset: 0.2, color: "#FFFFFF" },
      { offset: 0.4, color: "#FFFFFF" },
      { offset: 0.4, color: "#BE18D6" },
      { offset: 0.6, color: "#BE18D6" },
      { offset: 0.6, color: "#000000" },
      { offset: 0.8, color: "#000000" },
      { offset: 0.8, color: "#333EBD" },
      { offset: 1.0, color: "#333EBD" },
    ],
  },
  {
    id: "grad-agender",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#000000" },
      { offset: 0.1429, color: "#000000" },
      { offset: 0.1429, color: "#B9B9B9" },
      { offset: 0.2857, color: "#B9B9B9" },
      { offset: 0.2857, color: "#FFFFFF" },
      { offset: 0.4286, color: "#FFFFFF" },
      { offset: 0.4286, color: "#B8F483" },
      { offset: 0.5714, color: "#B8F483" },
      { offset: 0.5714, color: "#FFFFFF" },
      { offset: 0.7143, color: "#FFFFFF" },
      { offset: 0.7143, color: "#B9B9B9" },
      { offset: 0.8571, color: "#B9B9B9" },
      { offset: 0.8571, color: "#000000" },
      { offset: 1.0, color: "#000000" },
    ],
  },
 
  {
    id: "grad-aromantic",
    angle: 90,
    stops: [
      { offset: 0.0, color: "#3DA542" },
      { offset: 0.2, color: "#3DA542" },
      { offset: 0.2, color: "#A7D379" },
      { offset: 0.4, color: "#A7D379" },
      { offset: 0.4, color: "#FFFFFF" },
      { offset: 0.6, color: "#FFFFFF" },
      { offset: 0.6, color: "#A9A9A9" },
      { offset: 0.8, color: "#A9A9A9" },
      { offset: 0.8, color: "#000000" },
      { offset: 1.0, color: "#000000" },
    ],
  },
   ...EXTRA_GRADIENTS
];









// --- Pattern types ---
export type PatternDef = { id: string; svg: string; preview: string };

// Small helper to build inline SVG previews
const svgDataUrl = (s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;

// ============= Neon Night (16) ============
const P_GRID_NEON_16 = `
<linearGradient id="grid-neon-16-g" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" stop-color="#00DBDE"/>
  <stop offset="100%" stop-color="#FC00FF"/>
</linearGradient>
<pattern id="grid-neon-16" width="64" height="64" patternUnits="userSpaceOnUse">
  <rect width="64" height="64" fill="#0B0B10"/>
  <g stroke="url(#grid-neon-16-g)" stroke-opacity="0.85" stroke-width="1" shape-rendering="crispEdges">
    <path d="M16 0V64M32 0V64M48 0V64"/>
    <path d="M0 16H64M0 32H64M0 48H64"/>
  </g>
  <g stroke="url(#grid-neon-16-g)" stroke-width="1.5" shape-rendering="crispEdges">
    <path d="M0 0V64M0 0H64"/>
  </g>
</pattern>`;
const PREV_GRID_NEON_16 = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  ${P_GRID_NEON_16}
  <rect width="200" height="120" fill="url(#grid-neon-16)"/>
</svg>`);

// ============= Royal Gold (20) ============
const P_GRID_ROYAL_GOLD_20 = `
<linearGradient id="grid-royal-gold-20-g" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" stop-color="#FFD56B"/>
  <stop offset="100%" stop-color="#FF8C00"/>
</linearGradient>
<pattern id="grid-royal-gold-20" width="80" height="80" patternUnits="userSpaceOnUse">
  <rect width="80" height="80" fill="#1D1753"/>
  <g stroke="url(#grid-royal-gold-20-g)" stroke-opacity="0.9" stroke-width="1" shape-rendering="crispEdges">
    <path d="M20 0V80M40 0V80M60 0V80"/>
    <path d="M0 20H80M0 40H80M0 60H80"/>
  </g>
  <g stroke="url(#grid-royal-gold-20-g)" stroke-width="2" shape-rendering="crispEdges">
    <path d="M0 0V80M0 0H80"/>
  </g>
</pattern>`;
const PREV_GRID_ROYAL_GOLD_20 = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  ${P_GRID_ROYAL_GOLD_20}
  <rect width="200" height="120" fill="url(#grid-royal-gold-20)"/>
</svg>`);

// ============= Karayib Breeze (24) ============
const P_GRID_KARAYIB_24 = `
<linearGradient id="grid-karayib-24-g" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" stop-color="#00B894"/>
  <stop offset="100%" stop-color="#1B9CFC"/>
</linearGradient>
<pattern id="grid-karayib-24" width="96" height="96" patternUnits="userSpaceOnUse">
  <rect width="96" height="96" fill="#061B2A"/>
  <g stroke="url(#grid-karayib-24-g)" stroke-opacity="0.75" stroke-width="1" shape-rendering="crispEdges">
    <path d="M24 0V96M48 0V96M72 0V96"/>
    <path d="M0 24H96M0 48H96M0 72H96"/>
  </g>
  <g stroke="url(#grid-karayib-24-g)" stroke-width="2" shape-rendering="crispEdges">
    <path d="M0 0V96M0 0H96"/>
  </g>
</pattern>`;
const PREV_GRID_KARAYIB_24 = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  ${P_GRID_KARAYIB_24}
  <rect width="200" height="120" fill="url(#grid-karayib-24)"/>
</svg>`);

// ============= Lilac Soft (18) ============
const P_GRID_LILAC_18 = `
<linearGradient id="grid-lilac-soft-18-g" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" stop-color="#FBC2EB"/>
  <stop offset="100%" stop-color="#A18CD1"/>
</linearGradient>
<pattern id="grid-lilac-soft-18" width="72" height="72" patternUnits="userSpaceOnUse">
  <rect width="72" height="72" fill="#FFFDF8"/>
  <g stroke="url(#grid-lilac-soft-18-g)" stroke-opacity="0.65" stroke-width="1" shape-rendering="crispEdges">
    <path d="M18 0V72M36 0V72M54 0V72"/>
    <path d="M0 18H72M0 36H72M0 54H72"/>
  </g>
  <g stroke="url(#grid-lilac-soft-18-g)" stroke-width="1.8" stroke-opacity="0.9" shape-rendering="crispEdges">
    <path d="M0 0V72M0 0H72"/>
  </g>
</pattern>`;
const PREV_GRID_LILAC_18 = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  ${P_GRID_LILAC_18}
  <rect width="200" height="120" fill="url(#grid-lilac-soft-18)"/>
</svg>`);

// ============= Graphite (12) — subtle white =============
const P_GRID_GRAPHITE_12 = `
<pattern id="grid-graphite-12" width="48" height="48" patternUnits="userSpaceOnUse">
  <rect width="48" height="48" fill="#0D1117"/>
  <g stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="1" shape-rendering="crispEdges">
    <path d="M12 0V48M24 0V48M36 0V48"/>
    <path d="M0 12H48M0 24H48M0 36H48"/>
  </g>
  <g stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1.5" shape-rendering="crispEdges">
    <path d="M0 0V48M0 0H48"/>
  </g>
</pattern>`;
const PREV_GRID_GRAPHITE_12 = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  ${P_GRID_GRAPHITE_12}
  <rect width="200" height="120" fill="url(#grid-graphite-12)"/>
</svg>`);

// ============= Mint Cream (22) =============
const P_GRID_MINT_22 = `
<pattern id="grid-mint-22" width="88" height="88" patternUnits="userSpaceOnUse">
  <rect width="88" height="88" fill="#F5FFF8"/>
  <g stroke="#9AD1C3" stroke-opacity="0.6" stroke-width="1" shape-rendering="crispEdges">
    <path d="M22 0V88M44 0V88M66 0V88"/>
    <path d="M0 22H88M0 44H88M0 66H88"/>
  </g>
  <g stroke="#5AA592" stroke-width="1.6" stroke-opacity="0.9" shape-rendering="crispEdges">
    <path d="M0 0V88M0 0H88"/>
  </g>
</pattern>`;
const PREV_GRID_MINT_22 = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  ${P_GRID_MINT_22}
  <rect width="200" height="120" fill="url(#grid-mint-22)"/>
</svg>`);

// ============= Dots — Cocoa (14) =============
const P_GRID_DOTS_COCOA_14 = `
<pattern id="grid-dots-cocoa-14" width="14" height="14" patternUnits="userSpaceOnUse">
  <rect width="14" height="14" fill="#FFF8F0"/>
  <circle cx="7" cy="7" r="0.9" fill="#7A5C4D" fill-opacity="0.55"/>
</pattern>`;
const PREV_GRID_DOTS_COCOA_14 = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  ${P_GRID_DOTS_COCOA_14}
  <rect width="200" height="120" fill="url(#grid-dots-cocoa-14)"/>
</svg>`);

// ============= Diamond Cyan (20, rotated) =============
const P_GRID_DIAMOND_CYAN_20 = `
<linearGradient id="grid-diamond-cyan-20-g" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" stop-color="#56CCF2"/>
  <stop offset="100%" stop-color="#2F80ED"/>
</linearGradient>
<pattern id="grid-diamond-cyan-20" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <rect width="80" height="80" fill="#0B1530"/>
  <g stroke="url(#grid-diamond-cyan-20-g)" stroke-opacity="0.8" stroke-width="1" shape-rendering="crispEdges">
    <path d="M20 0V80M40 0V80M60 0V80"/>
    <path d="M0 20H80M0 40H80M0 60H80"/>
  </g>
  <g stroke="url(#grid-diamond-cyan-20-g)" stroke-width="1.7" shape-rendering="crispEdges">
    <path d="M0 0V80M0 0H80"/>
  </g>
</pattern>`;
const PREV_GRID_DIAMOND_CYAN_20 = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  ${P_GRID_DIAMOND_CYAN_20}
  <rect width="200" height="120" fill="url(#grid-diamond-cyan-20)"/>
</svg>`);

// ======================================================
// Export: plug straight into your Palette PATTERNS usage
// ======================================================
export const EXTRA_PATTERNS: PatternDef[] = [
  { id: "grid-neon-16",         svg: P_GRID_NEON_16,         preview: PREV_GRID_NEON_16 },
  { id: "grid-royal-gold-20",   svg: P_GRID_ROYAL_GOLD_20,   preview: PREV_GRID_ROYAL_GOLD_20 },
  { id: "grid-karayib-24",      svg: P_GRID_KARAYIB_24,      preview: PREV_GRID_KARAYIB_24 },
  { id: "grid-lilac-soft-18",   svg: P_GRID_LILAC_18,        preview: PREV_GRID_LILAC_18 },
  { id: "grid-graphite-12",     svg: P_GRID_GRAPHITE_12,     preview: PREV_GRID_GRAPHITE_12 },
  { id: "grid-mint-22",         svg: P_GRID_MINT_22,         preview: PREV_GRID_MINT_22 },
  { id: "grid-dots-cocoa-14",   svg: P_GRID_DOTS_COCOA_14,   preview: PREV_GRID_DOTS_COCOA_14 },
  { id: "grid-diamond-cyan-20", svg: P_GRID_DIAMOND_CYAN_20, preview: PREV_GRID_DIAMOND_CYAN_20 },
];






















export const PATTERNS: PatternDef[] = [
  {
    id: "pat-stripes",
    svg: `
<pattern id="pat-stripes" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
  <rect width="12" height="12" fill="white"/>
  <rect x="0" y="0" width="6" height="12" fill="#f2f2f2"/>
</pattern>`.trim(),
    preview:
      `data:image/svg+xml;utf8,` +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="white"/><rect width="32" height="32" fill="url(#pat-stripes)"/><defs><pattern id="pat-stripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><rect width="8" height="8" fill="white"/><rect width="4" height="8" fill="#f2f2f2"/></pattern></defs></svg>`
      ),
  },
  {
    id: "pat-dots",
    svg: `
<pattern id="pat-dots" patternUnits="userSpaceOnUse" width="12" height="12">
  <rect width="12" height="12" fill="white"/>
  <circle cx="3" cy="3" r="1.8" fill="#e6e6e6"/>
</pattern>`.trim(),
    preview:
      `data:image/svg+xml;utf8,` +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="white"/><rect width="32" height="32" fill="url(#pat-dots)"/><defs><pattern id="pat-dots" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="white"/><circle cx="2.5" cy="2.5" r="1.6" fill="#e6e6e6"/></pattern></defs></svg>`
      ),
  },
  {
    id: "pat-grid",
    svg: `
<pattern id="pat-grid" patternUnits="userSpaceOnUse" width="16" height="16">
  <rect width="16" height="16" fill="white"/>
  <path d="M0 0H16M0 0V16" stroke="#eaeaea" stroke-width="1"/>
</pattern>`.trim(),
    preview:
      `data:image/svg+xml;utf8,` +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="white"/><rect width="32" height="32" fill="url(#pat-grid)"/><defs><pattern id="pat-grid" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="white"/><path d="M0 0H8M0 0V8" stroke="#eaeaea" stroke-width="1"/></pattern></defs></svg>`
      ),
  },
  ...EXTRA_PATTERNS
];