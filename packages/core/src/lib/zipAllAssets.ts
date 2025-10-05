// src/lib/zipAllAssets.ts
import "server-only";
import { cloudinary } from "./cloudinary";

export type ZipAsset = {
  storageKey?: string;            // Cloudinary public_id (no ext)
  url: string;                    // fallback to parse if needed
  resourceType?: "image" | "raw" | "video";
  deliveryType?: "upload" | "authenticated" | "private";
};

function parseFromUrl(u: string) {
  const url = new URL(u);
  const p = url.pathname.split("/").filter(Boolean);
  const rt = p[1] as "image"|"raw"|"video";
  const dt = p[2] as "upload"|"authenticated"|"private";
  const tail = p[3]?.startsWith("v") ? p.slice(4) : p.slice(3);
  const withExt = tail.join("/");
  const dot = withExt.lastIndexOf(".");
  const pid = dot === -1 ? withExt : withExt.slice(0, dot);
  return { resourceType: rt, deliveryType: dt, publicId: pid };
}

export async function zipAllAssets(assets: ZipAsset[]) {
  if (!assets?.length) throw new Error("No assets to zip");

  const fqids = assets.map(a => {
    const parsed = parseFromUrl(a.url);
    const rt  = a.resourceType ?? parsed.resourceType;
    const dt  = a.deliveryType ?? parsed.deliveryType;
    const pid = a.storageKey   ?? parsed.publicId;
    return `${rt}/${dt}/${pid}`;
  });

  return cloudinary.utils.download_archive_url({
    fully_qualified_public_ids: fqids,
    target_format: "zip",
    flatten_folders: false,
    use_original_filename: true,
    // expires_at: Math.floor(Date.now()/1000) + 3600, // optional 1h expiry
  });
}
