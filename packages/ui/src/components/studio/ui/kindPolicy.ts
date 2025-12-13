// ui/kindPolicy.ts
import type { ProductDetailResult } from "@acme/core/types";

export type KindPolicy = {
  allow: { digital: boolean; print: boolean };
  // hide = UI groups that should not render for this kind
  hide: Partial<Record<"format" | "license" | "size" | "material" | "frame", boolean>>;
  // renderMode can hint special layout
  renderMode?: "default" | "book";
};

export function getKindPolicy(product: ProductDetailResult) {
  switch (product.kind) {
    case "BOOK_DIGITAL": {
      const hasEditions = Array.isArray(product.sizes) && product.sizes.length > 0;
      return {
        allow: { digital: true, print: true },
        hide: {
          material: true,
          frame: true,
          // keep format (PDF/EPUB) and digital license visible
          size: !hasEditions, // show sizes only if you provided editions/trim sizes
        },
        renderMode: "book",     // ⬅️ tell the UI to use book layout
      };
    }
    case "STICKER":
      return { allow: { digital: false, print: true }, hide: { license: true, material: true, frame: true }, renderMode: "default" };
    case "MUG":
      return { allow: { digital: false, print: true }, hide: { license: true, material: true, frame: true, format: true }, renderMode: "default" };
    case "CARD":
      return { allow: { digital: false, print: true }, hide: { license: true, material: true, frame: true }, renderMode: "default" };
    case "ART":
      return { allow: { digital: true, print: true }, hide: {}, renderMode: "default" };
    case "OTHER":
    default:
      return { allow: { digital: true, print: true }, hide: {}, renderMode: "default" };
  }
}
