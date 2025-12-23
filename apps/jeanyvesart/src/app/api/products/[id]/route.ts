// src/app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient,  } from "@prisma/client";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

export const runtime = "nodejs";
const db = new PrismaClient();

// helpers



export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const productId = url.pathname.split("/").pop()!;

  // Identify caller
 const { userId, guestId } = await getPrincipalFromRequest(req, authOptions);

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
          reservedOrderId: true,
          reservedUntil: true,
          reservedAt: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }



  // Cart lookup (only current caller’s cart)
  const cartWhere = userId ? { userId, site: "JEANYVES" } : guestId ? { guestId, site: "JEANYVES" } : { id: "__nope__" };
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

  const mergedThumbs = product.thumbnails;


  // const digitalVariants = product.variants.filter((v) => v.type === "DIGITAL");
  // const printVariants = product.variants.filter((v) => v.type === "PRINT");
  const originalVariant = product.variants.find((v) => v.type === "ORIGINAL") || null;

  const result = {
    id: product.id,
    kind: product.kind,
    requiresShipping: product.requiresShipping,
    category: product.category?.name ?? null,
    title: product.title,
    description: product.description,
    price: product.price,
    imageUrl:  product.thumbnails[0] ?? "/placeholder.png",
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


    originalVariant,

    // kind-aware summary for the UI info section
  

  
    reviews: product.reviews,
  };

  return NextResponse.json(result);
}
