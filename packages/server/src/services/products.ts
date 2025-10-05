import { prisma } from "@acme/core/lib/prisma";          // ✅ fix
export async function listProductsCore(params: {
  types?: Array<"DIGITAL" | "PRINT" | "ORIGINAL"> | "ALL";
  userId?: string | null;
  guestId?: string | null;
}) {
  type Variant = "DIGITAL" | "PRINT" | "ORIGINAL";
  const NON_ORIGINAL: Variant[] = ["DIGITAL", "PRINT"];
  const VALID = new Set<Variant>(["DIGITAL", "PRINT", "ORIGINAL"]);

  // Normalize
  let normalized: Variant[] | "ALL";
  if (params.types === "ALL") {
    normalized = "ALL";
  } else if (!params.types || (Array.isArray(params.types) && params.types.length === 0)) {
    normalized = NON_ORIGINAL; // default: non-originals
  } else {
    const filtered = (params.types as Variant[]).filter(t => VALID.has(t));
    normalized = filtered.includes("ORIGINAL") ? (["ORIGINAL"] as Variant[]) : NON_ORIGINAL;
  }

  // Build `where`
  let where: any = {};
  if (normalized === "ALL") {
    where = {};
  } else if (normalized.length === 1 && normalized[0] === "ORIGINAL") {
    // Strict ORIGINAL only (exclude nulls here)
    where = { variants: { some: { type: "ORIGINAL" } } };
  } else {
    // Non-original path: include DIGITAL/PRINT *and* NULL types
where = {
  OR: [
    { variants: { some: { OR: [{ type: { in: normalized } }, { type: { equals: null } }] } } },
    { variants: { none: {} } } // products with zero variants
  ]
};

  }

  const designsWhere =
    params.userId || params.guestId
      ? { OR: [{ userId: params.userId ?? undefined }, { guestId: params.guestId ?? undefined }] }
      : undefined;

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true, title: true, price: true, thumbnails: true, publicId: true,
      salePrice: true, salePercent: true, saleStartsAt: true, saleEndsAt: true,
      sizes: true,
      _count: { select: { orderItems: true } },
      designs: { select: { previewUrl: true }, where: designsWhere, take: 1 }
    },
    orderBy: { createdAt: "desc" }
  });

  return products.map(p => {
    const thumbs = [...p.thumbnails];
    if (p.designs[0]?.previewUrl) thumbs[0] = p.designs[0].previewUrl!;
    return { ...p, thumbnails: thumbs, purchaseCount: p._count.orderItems };
  });
}



// import { prisma } from "../prisma";

/** Server builder that matches your current /api/products/[id] response shape */
export async function buildProductDetail(payload: {
  productId: string;
  userId?: string;
  guestId?: string;
}) {
  const { productId, userId, guestId } = payload;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true } },
      reviews: true,
      variants: true,
    },
  });
  if (!product) return null;

  // user/guest design
  const userDesign = userId
    ? await prisma.userDesign.findUnique({
        where: { userId_productId: { userId, productId } },
        select: { id: true, previewUrl: true, previewPublicId: true, previewUpdatedAt: true },
      })
    : guestId
    ? await prisma.userDesign.findUnique({
        where: { guestId_productId: { guestId, productId } },
        select: { id: true, previewUrl: true, previewPublicId: true, previewUpdatedAt: true },
      })
    : null;

  // cart snapshot (to flag inUserCart per variant)
  const cartWhere = userId ? { userId } : guestId ? { guestId } : { id: "__none__" };
  const cart = await prisma.cart.findFirst({
    where: cartWhere,
    include: { items: { where: { productId }, include: { digitalVariant: true, printVariant: true, originalVariant: true } } },
  });
  const cartVariantIds = new Set<string>();
  for (const it of cart?.items ?? []) {
    if (it.digitalVariant) cartVariantIds.add(it.digitalVariant.id);
    if (it.printVariant) cartVariantIds.add(it.printVariant.id);
    if (it.originalVariant) cartVariantIds.add(it.originalVariant.id);
  }

  const mergedThumbs = product.thumbnails.length
    ? [userDesign?.previewUrl ?? product.thumbnails[0], ...product.thumbnails.slice(1)]
    : userDesign?.previewUrl
    ? [userDesign.previewUrl]
    : [];

  return {
    id: product.id,
    category: product.category?.name ?? null,
    title: product.title,
    description: product.description,
    price: product.price,
    imageUrl: userDesign?.previewUrl ?? product.thumbnails[0] ?? "/placeholder.png",
    thumbnails: mergedThumbs,
    formats: product.formats,
    svgPreview: product.svgPreview,
    variants: product.variants.map((v) => ({ ...v, inUserCart: cartVariantIds.has(v.id) })),
    reviews: product.reviews,
    salePercent: product.salePercent,
    salePrice: product.salePrice,
    saleStartsAt: product.saleStartsAt,
    saleEndsAt: product.saleEndsAt,
    sizes: product.sizes,
    userDesign: userDesign
      ? {
          id: userDesign.id,
          previewUrl: userDesign.previewUrl,
          previewPublicId: userDesign.previewPublicId,
          previewUpdatedAt: userDesign.previewUpdatedAt,
        }
      : null,
    userDesignPreviewUrl: userDesign?.previewUrl ?? null,
  };
}
