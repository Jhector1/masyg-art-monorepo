// src/app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

export const runtime = "nodejs";
const db = new PrismaClient();

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const productId = url.pathname.split("/").pop()!;

  // Identify the caller (prefer logged-in user over guest if both exist)
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true } },
      reviews: true,
      variants: true,
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // --- Fetch the caller's design for this product (if any) ---
  // Prefer userId; otherwise use guestId. (Both are unique per product via schema constraints.)
  const userDesign = userId
    ? await db.userDesign.findUnique({
        where: { userId_productId: { userId, productId } },
        select: {
          id: true,
          previewUrl: true,
          previewPublicId: true,
          previewUpdatedAt: true,
        },
      })
    : guestId
    ? await db.userDesign.findUnique({
        where: { guestId_productId: { guestId, productId } },
        select: {
          id: true,
          previewUrl: true,
          previewPublicId: true,
          previewUpdatedAt: true,
        },
      })
    : null;

  // --- Cart lookup (safe single-branch match; avoid OR with undefined) ---
  const cartWhere =
    userId ? { userId } : guestId ? { guestId } : { id: "__nope__" };

  const cart = await db.cart.findFirst({
    where: cartWhere,
    include: {
      items: {
        where: { productId },
        include: { digitalVariant: true, printVariant: true },
      },
    },
  });

  let cartVariantIds: string[] = [];
  if (cart) {
    cartVariantIds = cart.items.flatMap((item) => {
      const ids: string[] = [];
      if (item.digitalVariant) ids.push(item.digitalVariant.id);
      if (item.printVariant) ids.push(item.printVariant.id);
      return ids;
    });
  }
const mergedThumbs = product.thumbnails.length
  ? [userDesign?.previewUrl ?? product.thumbnails[0], ...product.thumbnails.slice(1)]
  : (userDesign?.previewUrl ? [userDesign.previewUrl] : []);
  const result = {
    id: product.id,
    category: product.category?.name ?? null,
    title: product.title,
    description: product.description,
    price: product.price,
    imageUrl:  userDesign?.previewUrl ?? product.thumbnails[0] ?? "/placeholder.png",
thumbnails: mergedThumbs ,
    formats: product.formats,
    svgPreview: product.svgPreview,
    variants: product.variants.map((v) => ({
      ...v,
      inUserCart: cartVariantIds.includes(v.id),
    })),
    reviews: product.reviews,
    salePercent: product.salePercent,
    salePrice: product.salePrice,
    saleStartsAt: product.saleStartsAt,
    saleEndsAt: product.saleEndsAt,
    sizes: product.sizes,

    // 👇 New fields: current user's/guest's design info for this product
    userDesign: userDesign
      ? {
          id: userDesign.id,
          previewUrl: userDesign.previewUrl,
          previewPublicId: userDesign.previewPublicId,
          previewUpdatedAt: userDesign.previewUpdatedAt,
        }
      : null,
    // (optional convenience alias if you just need the URL)
    userDesignPreviewUrl: userDesign?.previewUrl ?? null,
  };

  return NextResponse.json(result);
}
