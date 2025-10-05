import { prisma } from "./prisma";
import { cloudinary } from "./cloudinary";
import { rootFromPublicId, subfolders, fallbackRoot } from "./productFolders";
// import type { CldResourceType } from "@prisma/client";

const RTs: Array<"image" | "raw" | "video"> = ["image", "raw", "video"];

async function deleteByPrefix(prefix: string) {
  // Delete resources under prefix for both image & raw (and video, just in case)
  for (const rt of RTs) {
    try {
      // Cloudinary pages deletions; call until empty
      // (simplify: one call is often enough; if you expect >1000 assets, iterate next_cursor)
      await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: rt, invalidate: true });
    } catch {
      /* ignore and continue DB cleanup */
    }
  }
}

async function deleteFolderCascade(root: string) {
  const subs = subfolders(root);
  const toTry = [subs.svgPreview, subs.svg, subs.thumbnails, subs.formats, subs.main, root];
  for (const f of toTry) {
    try {
      await cloudinary.api.delete_folder(f);
    } catch {
      /* ignore – only succeeds when folder is empty */
    }
  }
}

export async function deleteProductDeep(productId: string, opts?: { hard?: boolean }) {
  // Load product + related public_ids we may explicitly nuke
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      assets: { select: { storageKey: true, url: true, resourceType: true } },
      designs: { select: { previewPublicId: true } }, // UserDesign previews
    },
  });
  if (!product) throw new Error("Product not found");

  // Compute root folder
  let root = rootFromPublicId(product.publicId);
  if (!root) root = fallbackRoot(product.id, product.category?.name);

  // Best-effort: clear by prefix (covers everything your uploader made)
  await deleteByPrefix(root);

  // Also delete any storageKey/publicIds we have on ProductAsset and UserDesign previews
  const explicitIds = new Set<string>();
  for (const a of product.assets) if (a.storageKey) explicitIds.add(a.storageKey);
  for (const d of product.designs) if (d.previewPublicId) explicitIds.add(d.previewPublicId);

  if (explicitIds.size > 0) {
    for (const rt of RTs) {
      try {
        await cloudinary.api.delete_resources([...explicitIds], { resource_type: rt, invalidate: true });
      } catch { /* ignore */ }
    }
  }

  // Then drop folders
  await deleteFolderCascade(root);

  // DB cleanup (transaction order prevents FK failures)
  await prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { productId } });
    await tx.favorite.deleteMany({ where: { productId } });
    await tx.review.deleteMany({ where: { productId } });
    await tx.productVariant.deleteMany({ where: { productId } });

    // Designs & usage/entitlements
    await tx.designUsage.deleteMany({ where: { productId } });
    await tx.designEntitlement.deleteMany({ where: { productId } });
    await tx.userDesign.deleteMany({ where: { productId } });

    // Purchased snapshots: keep by default; purge on hard
    if (opts?.hard) {
      await tx.purchasedDesign.deleteMany({ where: { productId } });
    }

    await tx.productAsset.deleteMany({ where: { productId } });

 // … inside deleteProductDeep, safe (non-hard) path:
if (opts?.hard) {
  await tx.orderItem.deleteMany({ where: { productId } });
} else {
  // Try to NULL-out the FK if your DB schema allows it.
  try {
    // Postgres/SQLite quoting (adjust table/column names if you’ve mapped them)
    await tx.$executeRaw`UPDATE "OrderItem" SET "productId" = NULL WHERE "productId" = ${productId}`;
  } catch {
    // Column not nullable or DB refuses; keep lines attached and let final delete fail if FK blocks it.
  }
}


    await tx.product.delete({ where: { id: productId } });
  });

  return { ok: true, productId };
}
