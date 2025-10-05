import slugify from "slugify";

/**
 * From your publicId like:
 *  products-dev/<safeCategory>/<uuid>/main/original
 * produce the root folder:
 *  products-dev/<safeCategory>/<uuid>
 */
export function rootFromPublicId(publicId?: string | null): string | null {
  if (!publicId) return null;
  const parts = publicId.split("/").filter(Boolean);
  // Expect .../<uuid>/main/original
  if (parts.length >= 4 && parts.at(-2) === "main") {
    return parts.slice(0, -2).join("/");
  }
  // Fallback: drop the last segment to get a parent
  if (parts.length >= 2) return parts.slice(0, -1).join("/");
  return null;
}

/** Build per-subfolder path strings */
export function subfolders(root: string) {
  return {
    main: `${root}/main`,
    thumbnails: `${root}/thumbnails`,
    svg: `${root}/svg`,
    svgPreview: `${root}/svg-preview`,
    formats: `${root}/formats`,
  };
}

/** Your uploader uses slugified category name */
export function safeCategory(name: string) {
  return slugify(name, { lower: true, strict: true });
}

/** Read NEXT_ENV || NODE_ENV for prefix building */
export function currentEnv() {
  return process.env.NEXT_ENV ?? process.env.NODE_ENV ?? "dev";
}

/** If we can't parse from publicId, fallback folder */
export function fallbackRoot(productId: string, categoryName?: string) {
  const env = currentEnv();
  const cat = categoryName ? safeCategory(categoryName) : "uncategorized";
  return `products-${env}/${cat}/${productId}`;
}
