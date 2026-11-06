import "server-only";
import { v2 as cloudinary } from "cloudinary";

/** Only internally uploaded authenticated raw assets are accepted, never URLs. */
export function parsePrivateDigitalStorageKey(storageKey: string, organizationId: string) {
  const prefix = "cloudinary:raw:authenticated:";
  if (!storageKey.startsWith(prefix)) throw new Error("Unsupported private storage backend");
  const id = storageKey.slice(prefix.length);
  const match = /^ziledigital\/([A-Za-z0-9_-]{3,128})\/products\/([A-Za-z0-9_-]{3,128})\/digital\/[0-9a-f-]{36}\.(png|jpg|webp|svg|pdf|zip)$/.exec(id);
  if (!match || match[1] !== organizationId) throw new Error("Invalid private storage identity");
  return { publicId: id, extension: match[3] };
}

export function privateDigitalDownloadUrl(storageKey: string, organizationId: string) {
  const { publicId, extension } = parsePrivateDigitalStorageKey(storageKey, organizationId);
  cloudinary.config({ secure: true });
  const config = cloudinary.config();
  if (!config.cloud_name || !config.api_key || !config.api_secret)
    throw new Error("Cloudinary credentials not configured");
  const url = cloudinary.utils.private_download_url(publicId, extension, {
    resource_type: "raw", type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 60, attachment: true,
  });
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "api.cloudinary.com" ||
      !parsed.pathname.startsWith(`/v1_1/${encodeURIComponent(config.cloud_name)}/raw/download`))
    throw new Error("Unexpected private file provider URL");
  return url;
}

export function downloadFilename(label: string, extension: string) {
  if (!/^(png|jpg|webp|svg|pdf|zip)$/.test(extension)) throw new Error("Invalid file format");
  const normalized=label.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]+/g,"_").trim().slice(0,100) || "artwork";
  const stem=normalized.replace(/\.[a-zA-Z0-9]{2,5}$/,"" ).replace(/\.+$/g, "");
  return `${stem || "artwork"}.${extension}`;
}
