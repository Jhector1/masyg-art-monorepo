// src/components/shared/purchase/format-utils.ts
export function getUniqueFormats(urls: string[]) {
  const seen = new Set<string>();
  return urls
    .map((url) => (url.split("?")[0].split(".").pop() || "").toLowerCase())
    .filter((ext) => ext && !seen.has(ext) && seen.add(ext))
    .map((ext) => ({ type: ext, resolution: "n/a", multiplier: 1 }));
}
