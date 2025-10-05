// File: src/app/api/cart/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { AddToCartBody, CartSelectedItem, productListSelect } from "@acme/core/types";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { applyBundleIfBoth, computeBaseUnit, getEffectiveSale, roundMoney } from "@acme/core/lib/pricing";
// import { getSizeMultiplier } from "@/utils/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

/* ────────────────────────────────────────────────────────────────────
   GET /api/cart
   Returns cart lines with server-computed prices and sale metadata
   ──────────────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────────────
   GET /api/cart
   Returns cart lines with server-computed prices and sale metadata
   ──────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const digitalVariantId = url.searchParams.get("digitalVariantId");
  const printVariantId = url.searchParams.get("printVariantId");
  const live = url.searchParams.get("liveDesignPreview") === "1";

  const cart = await prisma.cart.findFirst({
    where: { OR: [{ userId }, { guestId }] },
    select: { id: true },
  });

  if (!cart) {
    return NextResponse.json([] as CartSelectedItem[], {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Fast probe: “is this exact variant in the cart?”
  if (productId && (digitalVariantId || printVariantId)) {
    const where: Record<string, string> = { cartId: cart.id, productId };
    if (digitalVariantId) where.digitalVariantId = digitalVariantId;
    if (printVariantId) where.printVariantId = printVariantId;

    const item = await prisma.cartItem.findFirst({ where });
    return NextResponse.json(
      { inCart: Boolean(item) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Pull cart lines (note we keep productId and any linked design relation)
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: {
      id: true,
      productId: true,
      price: true,
      originalPrice: true,
      quantity: true,
      printVariant: true,
      digitalVariant: true,
      product: {
        select: {
          ...productListSelect,
          salePrice: true,
          salePercent: true,
          saleStartsAt: true,
          saleEndsAt: true,
        },
      },
      designId: true,
      previewUrlSnapshot: true,
      styleSnapshot: true,
      design: { select: { previewUrl: true, previewUpdatedAt: true } }, // linked design (may be null)
    },
  });

  // Optional only: when live=1, fetch latest per-product UserDesign to use
  // *only* if a cart line has no linked design (designId is null).
  let newestByProduct:
    | Map<string, { url: string | null; ver: number | null }>
    | null = null;

  if (items.length && live) {
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    if (productIds.length) {
      const latestDesigns = await prisma.userDesign.findMany({
        where: {
          productId: { in: productIds },
          ...(userId ? { userId } : { guestId: guestId! }),
        },
        select: {
          productId: true,
          previewUrl: true,
          previewUpdatedAt: true,
          updatedAt: true,
        },
        orderBy: [{ productId: "asc" }, { updatedAt: "desc" }],
      });

      newestByProduct = new Map();
      for (const d of latestDesigns) {
        if (!newestByProduct.has(d.productId)) {
          newestByProduct.set(d.productId, {
            url: d.previewUrl ?? null,
            ver: d.previewUpdatedAt ? d.previewUpdatedAt.getTime() : null,
          });
        }
      }
    }
  }

  // Build response lines — strict precedence:
  // 1) linked cart design (only if designId is set)
  // 2) frozen snapshot (previewUrlSnapshot)
  // 3) product thumbnail
  // 4) (optional) live=1: latest product-level design if no linked design
  const products: CartSelectedItem[] = items.map((ci) => {
    // Linked cart design (trusted because it’s tied to cartItem.designId)
    const linkedDesignUrl = ci.design?.previewUrl
      ? ci.design.previewUpdatedAt
        ? `${ci.design.previewUrl}?v=${ci.design.previewUpdatedAt.getTime()}`
        : ci.design.previewUrl
      : null;

    // Optional live override only when there is no linked design
    let liveGlobalUrl: string | null = null;
    if (!linkedDesignUrl && newestByProduct) {
      const g = newestByProduct.get(ci.productId);
      liveGlobalUrl = g?.url ? (g.ver ? `${g.url}?v=${g.ver}` : g.url) : null;
    }

    const previewUrl =
      linkedDesignUrl ??
      ci.previewUrlSnapshot ??
      ci.product.thumbnails?.[0] ??
      liveGlobalUrl ??
      null;

    return {
      cartItemId: ci.id,
      cartPrice: ci.price,
      cartQuantity: ci.quantity,
      digital: ci.digitalVariant,
      print: ci.printVariant,
      ...ci.product,
      price: ci.price,
      originalPrice: ci.originalPrice ?? ci.price,
      previewUrl,
      isUserDesign: Boolean(ci.designId), // reflect true customization only
      saleStartsAt: ci.product.saleStartsAt,
      saleEndsAt: ci.product.saleEndsAt,
      salePercent: ci.product.salePercent,
      salePrice: ci.product.salePrice,
    };
  });

  return NextResponse.json(products, {
    headers: { "Cache-Control": "no-store" },
  });
}

/* ────────────────────────────────────────────────────────────────────
   POST /api/cart
   Creates a cart line; ignores any client-sent price; computes sale server-side
   ──────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  // Note: we'll ignore any client-provided price/originalPrice
  const {
    productId,
    digitalType,
    printType,
    license = "personal",
    quantity = 1,
    format = "png",
    size = null,
    material = null,
    frame = null,
    design,
    snapshot = true,
  } = (await req.json()) as AddToCartBody;

  if (!productId || (!digitalType && !printType)) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 }
    );
  }
  console.log("Type variant:", digitalType, printType);

  // Ensure cart exists
  let cart = await prisma.cart.findFirst({
    where: { OR: [{ userId }, { guestId }] },
  });
  if (!cart) cart = await prisma.cart.create({ data: { userId, guestId } });

  // (Optional) Design handling (ownership check, preview upload, snapshot)
  let designId: string | null = null;
  let previewUrlSnapshot: string | null = null;
  let styleSnapshot: any = null;

//  if (design) {
//   const found = await prisma.userDesign.findFirst({
//     where: {
//       productId,
//       ...(design.id ? { id: design.id } : {}),
//       OR: [{ userId: userId ?? "" }, { guestId: guestId ?? "" }],
//     },
//     select: {
//       id: true,
//       previewUrl: true,
//       previewPublicId: true,
//       previewUpdatedAt: true,
//     },
//   });
//   if (!found) {
//     return NextResponse.json(
//       { error: "Design not found or not owned by user." },
//       { status: 403 }
//     );
//   }

//   // Persist style/defs updates if provided
//   if (design.style || typeof design.defs !== "undefined") {
//     await prisma.userDesign.update({
//       where: { id: found.id },
//       data: {
//         ...(design.style ? { style: design.style } : {}),
//         ...(typeof design.defs !== "undefined" ? { defs: design.defs } : {}),
//       },
//     });
//   }

//     designId = found.id;

//     if (design.previewDataUrl?.startsWith("data:")) {
//       const base64 = design.previewDataUrl.split(",")[1];
//       const input = Buffer.from(base64, "base64");
//       const sharp = (await import("sharp")).default;
//       const webp = await sharp(input)
//         .resize({ width: 800, withoutEnlargement: true, fit: "inside" })
//         .webp({ quality: 70 })
//         .toBuffer();

//       const publicId = `products/designs/previews/design_${found.id}`;
//       const upload = await new Promise<any>((resolve, reject) => {
//         cloudinary.uploader
//           .upload_stream(
//             {
//               public_id: publicId,
//               resource_type: "image",
//               type: "upload",
//               overwrite: true,
//               format: "webp",
//               invalidate: true,
//             },
//             (err, result) => (err ? reject(err) : resolve(result))
//           )
//           .end(webp);
//       });

//       previewUrlSnapshot = upload.secure_url as string;

//       await prisma.userDesign.update({
//         where: { id: found.id },
//         data: {
//           previewPublicId: upload.public_id,
//           previewUrl: previewUrlSnapshot,
//           previewUpdatedAt: new Date(),
//         },
//       });
//     }
// else {
//     // NEW: if no fresh upload, use existing design preview as snapshot
//     previewUrlSnapshot = found.previewUrl ?? null;
//   }
//     if (snapshot && design.style) {
//       styleSnapshot = design.style;
//     }
//   }

  // Create variants (if needed)


const newest = await prisma.userDesign.findFirst({
  where: { productId, ...(userId ? { userId } : { guestId }) },
  orderBy: { updatedAt: "desc" },
  select: {
    id: true,
    previewUrl: true,
    previewUpdatedAt: true,
    style: true,
  },
});

if (newest) {
  designId = newest.id;
  previewUrlSnapshot = newest.previewUrl ?? null; // frozen at add time
  styleSnapshot = newest.style ?? null;
}
  const digitalVariant = digitalType
    ? await prisma.productVariant.create({
        data: { productId, type: "DIGITAL", format, license: String(license) },
      })
    : null;

  const printVariant = printType
    ? await prisma.productVariant.create({
        data: { productId, type: "PRINT", format, size, material, frame },
      })
    : null;

  // Authoritative pricing
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      price: true,
      salePrice: true,
      salePercent: true,
      saleStartsAt: true,
      saleEndsAt: true,
          sizes: true, // ← add this

    },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const baseUnit= computeBaseUnit({
    productBase: product.price,
    format,
    size,
    material,
    frame,
    license,
    digital: digitalVariant,
    print: printVariant,
      sizeList: product.sizes,     // ← NEW

  });
// Apply moderated size multiplier (only if there's a print branch/size)
// const sizeFactor =
//   printVariant && size
//     ? getSizeMultiplier(size, product.sizes ?? undefined)  // shared logic
//     : 1;
//     const baseUnit = roundMoney(baseUnitRaw * sizeFactor);

  const sale = getEffectiveSale({
    price: baseUnit,
    salePrice: product.salePrice,
    salePercent: product.salePercent,
    saleStartsAt: product.saleStartsAt,
    saleEndsAt: product.saleEndsAt,
  });
// 🔥 Bundle 20% if both variants present (after sale)
const priceWithBundle = applyBundleIfBoth(baseUnit, digitalVariant, printVariant);
const priceWithSale   = sale.price;
const finalUnitPrice  = roundMoney(Math.min(priceWithSale, priceWithBundle));

  const created = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId,
      digitalVariantId: digitalVariant?.id ?? null,
      printVariantId: printVariant?.id ?? null,
      price: finalUnitPrice, // number
      originalPrice: baseUnit, // number
      quantity,
      designId,
      previewUrlSnapshot,
      styleSnapshot,
    },
  });

  return NextResponse.json({
    message: "Item added.",
    result: {
      cartItemId: created.id,
      cartId: cart.id,
      productId,
      digitalVariantId: digitalVariant?.id ?? null,
      printVariantId: printVariant?.id ?? null,
      price: created.price,
      originalPrice: created.originalPrice,
      quantity: created.quantity,
      designId,
      previewUrlSnapshot,
      styleSnapshot: !!styleSnapshot,
    },
  });
}

/* ────────────────────────────────────────────────────────────────────
   DELETE /api/cart
   Removes all lines for productId (and cleans up variants)
   ──────────────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const { productId } = await req.json();

  if (!productId) {
    return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  }

  const cart = await prisma.cart.findFirst({
    where: { OR: [{ userId }, { guestId }] },
  });
  if (!cart) {
    return NextResponse.json({ error: "Cart not found." }, { status: 404 });
  }

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id, productId },
  });

  const variantIds = items.flatMap((i) =>
    [i.digitalVariantId, i.printVariantId].filter((v): v is string =>
      Boolean(v)
    )
  );

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });

  if (variantIds.length) {
    await prisma.productVariant.deleteMany({
      where: { id: { in: variantIds } },
    });
  }

  return NextResponse.json({
    message: `Removed ${items.length} item(s) and ${variantIds.length} variant(s).`,
  });
}

/* ────────────────────────────────────────────────────────────────────
   PATCH /api/cart
   Updates variants and server-recomputes price; no client price allowed
   ──────────────────────────────────────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const {
    productId,
    digitalVariantId = null, // "ADD" | "REMOVE" | string | null
    printVariantId = null, // "ADD" | "REMOVE" | string | null
    updates = {},
  } = await req.json();

  if (!productId || (!digitalVariantId && !printVariantId)) {
    return NextResponse.json(
      { error: "Missing required fields or no variant to update." },
      { status: 400 }
    );
  }

  // Get cart & a single line for this product
  const cart = await prisma.cart.findFirst({
    where: { OR: [{ userId }, { guestId }] },
    include: { items: { where: { productId }, take: 1 } },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json(
      { error: "Product not found in cart." },
      { status: 404 }
    );
  }
  const cartItem = cart.items[0];

  // Helpers to shape variant data
  const asDigitalData = (u: any) => ({
    productId,
    type: "DIGITAL" as const,
    format: u.format ?? undefined,
    license: u.license ?? undefined,
  });
  const asPrintData = (u: any) => ({
    productId,
    type: "PRINT" as const,
    format: u.format ?? undefined,
    size: u.size ?? undefined,
    material: u.material ?? undefined,
    frame: u.frame ?? undefined,
  });

  let nextDigitalId: string | null | undefined =
    cartItem.digitalVariantId ?? null;
  let nextPrintId: string | null | undefined = cartItem.printVariantId ?? null;
  const maybeDeleteDigitalIds: string[] = [];
  const maybeDeletePrintIds: string[] = [];

  // Do variant adds/updates/removes inside a transaction
  await prisma.$transaction(
    async (tx) => {
      // DIGITAL branch
      if (digitalVariantId === "REMOVE") {
        if (nextDigitalId) maybeDeleteDigitalIds.push(nextDigitalId);
        await tx.cartItem.update({
          where: { id: cartItem.id },
          data: { digitalVariantId: null },
        });
        nextDigitalId = null;
      } else if (digitalVariantId === "ADD") {
        const created = await tx.productVariant.create({
          data: asDigitalData(updates),
          select: { id: true },
        });
        await tx.cartItem.update({
          where: { id: cartItem.id },
          data: { digitalVariantId: created.id },
        });
        nextDigitalId = created.id;
      } else if (typeof digitalVariantId === "string") {
        const updated = await tx.productVariant.updateMany({
          where: { id: digitalVariantId },
          data: asDigitalData(updates),
        });
        if (updated.count === 0) {
          const created = await tx.productVariant.create({
            data: asDigitalData(updates),
            select: { id: true },
          });
          await tx.cartItem.update({
            where: { id: cartItem.id },
            data: { digitalVariantId: created.id },
          });
          nextDigitalId = created.id;
        } else {
          nextDigitalId = digitalVariantId;
        }
      }

      // PRINT branch
      if (printVariantId === "REMOVE") {
        if (nextPrintId) maybeDeletePrintIds.push(nextPrintId);
        await tx.cartItem.update({
          where: { id: cartItem.id },
          data: { printVariantId: null },
        });
        nextPrintId = null;
      } else if (printVariantId === "ADD") {
        const created = await tx.productVariant.create({
          data: asPrintData(updates),
          select: { id: true },
        });
        await tx.cartItem.update({
          where: { id: cartItem.id },
          data: { printVariantId: created.id },
        });
        nextPrintId = created.id;
      } else if (typeof printVariantId === "string") {
        const updated = await tx.productVariant.updateMany({
          where: { id: printVariantId },
          data: asPrintData(updates),
        });
        if (updated.count === 0) {
          const created = await tx.productVariant.create({
            data: asPrintData(updates),
            select: { id: true },
          });
          await tx.cartItem.update({
            where: { id: cartItem.id },
            data: { printVariantId: created.id },
          });
          nextPrintId = created.id;
        } else {
          nextPrintId = printVariantId;
        }
      }
    },
    { timeout: 15000, maxWait: 5000 }
  );

  // Clean up orphans (variants no longer referenced)
  for (const id of maybeDeleteDigitalIds) {
    const stillRef = await prisma.cartItem.count({
      where: { digitalVariantId: id },
    });
    if (stillRef === 0)
      await prisma.productVariant.delete({ where: { id } }).catch(() => {});
  }
  for (const id of maybeDeletePrintIds) {
    const stillRef = await prisma.cartItem.count({
      where: { printVariantId: id },
    });
    if (stillRef === 0)
      await prisma.productVariant.delete({ where: { id } }).catch(() => {});
  }

 // If both variants removed, delete the cart line (idempotent)
const finalState = await prisma.cartItem.findUnique({
  where: { id: cartItem.id },
  select: { id: true, digitalVariantId: true, printVariantId: true },
});

if (!finalState) {
  // Already removed by another request or cascade; treat as success
  return NextResponse.json({
    message: "Cart item already removed.",
    digitalVariantId: null,
    printVariantId: null,
  });
}

if (!finalState.digitalVariantId && !finalState.printVariantId) {
  // Use deleteMany to avoid P2025 if a race deletes it first
  await prisma.cartItem.deleteMany({ where: { id: finalState.id } });
  return NextResponse.json({
    message: "Cart item removed because both variants were removed.",
    digitalVariantId: null,
    printVariantId: null,
  });
}


  // Recompute price from *current* selection and product sale fields
  const fresh = await prisma.cartItem.findUnique({
    where: { id: cartItem.id },
    include: {
      digitalVariant: true,
      printVariant: true,
      product: {
        select: {
          price: true,
          salePrice: true,
          salePercent: true,
          saleStartsAt: true,
          saleEndsAt: true,
              sizes: true, // ← add this

        },
      },
    },
  });
  if (!fresh?.product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  // Prefer updates for changed fields, else use variant values
  const fmt =
    (updates as any).format ??
    fresh.digitalVariant?.format ??
    fresh.printVariant?.format ??
    undefined;
  const sz = (updates as any).size ?? fresh.printVariant?.size ?? undefined;
  const mat =
    (updates as any).material ?? fresh.printVariant?.material ?? undefined;
  const frm = (updates as any).frame ?? fresh.printVariant?.frame ?? undefined;
  const lic =
    (updates as any).license ?? fresh.digitalVariant?.license ?? undefined;

  const baseUnit = computeBaseUnit({
    productBase: fresh.product.price,
    format: fmt,
    size: sz,
    material: mat,
    frame: frm,
    license: lic,
    digital: fresh.digitalVariant,
    print: fresh.printVariant,
      sizeList: fresh.product.sizes,     // ← NEW

  });

//   const sizeFactor =
//   fresh.printVariant && sz
//     ? getSizeMultiplier(String(sz), fresh.product.sizes ?? undefined)
//     : 1;

// const baseUnit = roundMoney(baseUnitRaw * sizeFactor);

  const sale = getEffectiveSale({
    price: baseUnit,
    salePrice: fresh.product.salePrice,
    salePercent: fresh.product.salePercent,
    saleStartsAt: fresh.product.saleStartsAt,
    saleEndsAt: fresh.product.saleEndsAt,
  });

  // 🔥 Bundle 20% if both variants present (after sale)
const priceWithBundle = applyBundleIfBoth(baseUnit, fresh.digitalVariant, fresh.printVariant);
const priceWithSale   = sale.price;
const finalUnitPrice  = roundMoney(Math.min(priceWithSale, priceWithBundle));


  await prisma.cartItem.update({
    where: { id: cartItem.id },
    data: { price: finalUnitPrice, originalPrice: baseUnit },
  });

  return NextResponse.json({
    message: "Cart item updated.",
    digitalVariantId: fresh.digitalVariant?.id ?? null,
    printVariantId: fresh.printVariant?.id ?? null,
    price: finalUnitPrice,
    originalPrice: baseUnit,
  });
}
