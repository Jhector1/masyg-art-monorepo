// File: src/scripts/backfill-product-assets.ts
import { PrismaClient } from "@prisma/client";
import probe from "probe-image-size";
import {
  upsertProductAsset,
  extFromUrl,
  mimeFromExt,
  isVectorExt,
  parseCloudinaryIdentity, // <-- use the new identity parser (publicId + resourceType + deliveryType)
} from "../lib/productAssets";

const prisma = new PrismaClient();

function guessResourceTypeFromMime(mime: string | undefined) {
  if (!mime) return "image" as const;
  if (mime.startsWith("image/")) return "image" as const;
  // PDFs/SVGs often delivered as raw by Cloudinary
  return "raw" as const;
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      formats: true,
      svgFormat: true,
      thumbnails: true,
      title: true,
    },
  });

  console.log(`Found ${products.length} products`);

  for (const p of products) {
    const urls: string[] = [];
    if (Array.isArray(p.formats)) urls.push(...p.formats);
    if (p.svgFormat) urls.push(p.svgFormat);

    for (const url of urls) {
      const ext = extFromUrl(url);
      if (!ext) continue;

      // Best-effort metadata
      let width: number | undefined;
      let height: number | undefined;
      let sizeBytes: number | undefined;
      try {
        const info = await probe(url);
        width = info?.width;
        height = info?.height;
        sizeBytes = info?.length;
      } catch {
        /* ignore probing errors */
      }

      // Parse Cloudinary identity (preferred), else fall back
      const id = parseCloudinaryIdentity(url); // { publicId, resourceType, deliveryType } | null
      const mime = mimeFromExt(ext);

      await upsertProductAsset(prisma, {
        productId: p.id,
        url,
        storageKey: id?.publicId ?? undefined, // Cloudinary public_id (no ext)
        previewUrl: p.thumbnails?.[0] ?? null,

        ext,
        mimeType: mime,
        isVector: isVectorExt(ext),

        width,
        height,
        sizeBytes,

        // Persist buckets so ZIP can use fully_qualified_public_ids
        resourceType: (id?.resourceType as any) ?? guessResourceTypeFromMime(mime),
        deliveryType: (id?.deliveryType as any) ?? "upload",
      });

      console.log(
        `Upserted asset for product ${p.id}: ${ext} ${url} ` +
        (id?.publicId ? `[${id.resourceType}/${id.deliveryType}/${id.publicId}]` : "")
      );
    }
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
