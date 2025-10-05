
import { cloudinary } from "@acme/core/lib/cloudinary";

import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

export const runtime = "nodejs";

/** Helpers */
export const isNonEmptyFile = (v: unknown): v is File => v instanceof File && v.size > 0;
export const getFiles = (fd: FormData, key: string) =>
  fd.getAll(key).filter(isNonEmptyFile) as File[];

/** TS-safe stream upload */
export async function uploadFile(
  file: File,
  opts: UploadApiOptions
): Promise<UploadApiResponse> {
  const buf = Buffer.from(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (err, res) => {
      if (err) return reject(err);
      resolve(res!);
    });
    stream.end(buf);
  });
}

/** Delete all resources under a prefix with a specific resource_type */
export async function deleteByPrefix(prefix: string, rt: "image" | "raw" | "video") {
  try {
    await cloudinary.api.delete_resources_by_prefix(prefix, {
      resource_type: rt,
      invalidate: true,
    });
  } catch {
    /* ignore */
  }
}

// helper: read a string from FormData and normalize "" -> undefined
export function getStr(fd: FormData, key: string) {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length ? s : undefined; // blank -> undefined (don't change)
}
