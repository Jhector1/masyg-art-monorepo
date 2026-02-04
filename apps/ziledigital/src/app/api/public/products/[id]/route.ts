// src/app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, VariantType, ProductKind } from "@prisma/client";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

export const runtime = "nodejs";
const db = new PrismaClient();

// helpers
function firstDefined<T>(...vals: (T | undefined | null)[]): T | null {
  for (const v of vals) if (v !== undefined && v !== null) return v as T;
  return null;
}

function summarizeKindInfo(params: {
  kind: ProductKind;
  variants: Array<{
    type: VariantType | null;
    size: string | null;
    material: string | null;
    attributes: any | null;
    widthIn: number | null;
    heightIn: number | null;
    depthIn: number | null;
    weightLb: number | null;
    year: number | null;
    medium: string | null;
    surface: string | null;
    framed: boolean | null;
    sku: string | null;
  }>;
  sizes: string[];
}) {
  const { kind, variants, sizes } = params;

  // Split
  const digital = variants.filter((v) => v.type === "DIGITAL");
  const print = variants.filter((v) => v.type === "PRINT");
  const original = variants.find((v) => v.type === "ORIGINAL") || null;

  // Per-kind summaries
  switch (kind) {
    case "STICKER": {
      // read the first PRINT variant as canonical
      const v = print[0];
      const attrs = (v?.attributes ?? {}) as Record<string, any>;
      return {
        kind,
        type: "PRINT",
        material: firstDefined(v?.material, attrs.stock, "Matte Vinyl"),
        finish: firstDefined(attrs.finish, "Matte"),
        cutType: firstDefined(attrs.cutType, "Die-cut"),
        packQuantity: firstDefined<number>(attrs.packQuantity, 1),
        sizes: sizes.length ? sizes : print.map((p) => p.size).filter(Boolean),
      };
    }

    case "MUG": {
      // look across PRINT sizes (11oz/15oz)
      const attrs = (print[0]?.attributes ?? {}) as Record<string, any>;
      const dishwasherSafe = Boolean(attrs.dishwasherSafe);
      const mugColor = firstDefined<string>(attrs.mugColor, "White");
      const mugSizes = print.map((p) => p.size).filter(Boolean);
      return {
        kind,
        type: "PRINT",
        mugColor,
        dishwasherSafe,
        sizes: mugSizes.length ? mugSizes : sizes,
        material: firstDefined(print[0]?.material, "Ceramic"),
      };
    }

    case "CARD": {
      const v = print[0];
      const attrs = (v?.attributes ?? {}) as Record<string, any>;
      return {
        kind,
        type: "PRINT",
        stock: firstDefined<string>(v?.material, "310gsm"),
        finish: firstDefined<string>(attrs.finish, "Smooth"),
        packQuantity: firstDefined<number>(attrs.packQuantity, 54),
        sizes: sizes.length ? sizes : print.map((p) => p.size).filter(Boolean),
      };
    }

    case "BOOK_DIGITAL": {
      const v = digital[0];
      const attrs = (v?.attributes ?? {}) as Record<string, any>;
      return {
        kind,
        type: "DIGITAL",
        isbn: attrs.isbn ?? null,
        pageCount: attrs.pageCount ?? null,
        language: attrs.language ?? "English",
        formatsHint: "PDF/EPUB",
      };
    }

    case "ART":
    case "OTHER": {
      // May have DIGITAL or PRINT sizes, or none
      const explicitSizes =
        sizes.length
          ? sizes
          : [...print, ...digital].map((p) => p.size).filter(Boolean);

      // ORIGINAL (if any) summary
      const originalSummary = original
        ? {
            widthIn: original.widthIn,
            heightIn: original.heightIn,
            depthIn: original.depthIn,
            weightLb: original.weightLb,
            year: original.year,
            medium: original.medium,
            surface: original.surface,
            framed: original.framed,
            sku: original.sku,
          }
        : null;

      return {
        kind,
        typeHint: original ? "ORIGINAL" : print.length ? "PRINT" : "DIGITAL",
        sizes: explicitSizes,
        original: originalSummary,
      };
    }
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const productId = url.pathname.split("/").pop()!;

  // Identify caller
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true } },
      reviews: true,
      variants: {
        select: {
          id: true,
          type: true,
          size: true,
          material: true,
          attributes: true,
          listPrice: true,
          status: true,
          inventory: true,
          // original/physical metadata:
          widthIn: true,
          heightIn: true,
          depthIn: true,
          weightLb: true,
          year: true,
          medium: true,
          surface: true,
          framed: true,
          sku: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // User design (user first, else guest)
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

  // Cart lookup (only current caller’s cart)
  const cartWhere = userId ? { userId } : guestId ? { guestId } : { id: "__nope__" };
  const cart = await db.cart.findFirst({
    where: cartWhere,
    include: {
      items: {
        where: { productId },
        include: { digitalVariant: true, printVariant: true, originalVariant: true },
      },
    },
  });

  let cartVariantIds: string[] = [];
  if (cart) {
    cartVariantIds = cart.items.flatMap((item) => {
      const ids: string[] = [];
      if (item.digitalVariant) ids.push(item.digitalVariant.id);
      if (item.printVariant) ids.push(item.printVariant.id);
      if (item.originalVariant) ids.push(item.originalVariant.id);
      return ids;
    });
  }

  const mergedThumbs = product.thumbnails.length
    ? [userDesign?.previewUrl ?? product.thumbnails[0], ...product.thumbnails.slice(1)]
    : userDesign?.previewUrl
    ? [userDesign.previewUrl]
    : [];

  // Derive kind-aware info
  const kindInfo = summarizeKindInfo({
    kind: product.kind as ProductKind,
    variants: product.variants as any,
    sizes: product.sizes ?? [],
  });

  const digitalVariants = product.variants.filter((v) => v.type === "DIGITAL");
  const printVariants = product.variants.filter((v) => v.type === "PRINT");
  const originalVariant = product.variants.find((v) => v.type === "ORIGINAL") || null;

  const result = {
    id: product.id,
    kind: product.kind,
    requiresShipping: product.requiresShipping,
    category: product.category?.name ?? null,
    title: product.title,
    description: product.description,
    price: product.price,
    imageUrl: userDesign?.previewUrl ?? product.thumbnails[0] ?? "/placeholder.png",
    thumbnails: mergedThumbs,
    formats: product.formats,
    svgPreview: product.svgPreview,
    salePercent: product.salePercent,
    salePrice: product.salePrice,
    saleStartsAt: product.saleStartsAt,
    saleEndsAt: product.saleEndsAt,
    sizes: product.sizes,

    // variants and cart flag
    variants: product.variants.map((v) => ({
      ...v,
      inUserCart: cartVariantIds.includes(v.id),
    })),

    digitalVariants,
    printVariants,
    originalVariant,

    // kind-aware summary for the UI info section
    kindInfo,

    // user design
    userDesign: userDesign
      ? {
          id: userDesign.id,
          previewUrl: userDesign.previewUrl,
          previewPublicId: userDesign.previewPublicId,
          previewUpdatedAt: userDesign.previewUpdatedAt,
        }
      : null,
    userDesignPreviewUrl: userDesign?.previewUrl ?? null,
    reviews: product.reviews,
  };

  return NextResponse.json(result);
}
