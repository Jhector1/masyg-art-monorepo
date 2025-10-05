// File: src/app/api/checkout/success/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma, VariantType } from "@prisma/client";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  if (!userId && !guestId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({
      hasDigital: false,
      hasPrint: false,
      order: null,
      digitalDownloads: [],
    });
  }

  const orClauses: Prisma.OrderWhereInput[] = [
    ...(userId ? [{ userId }] : []),
    ...(guestId ? [{ guestId }] : []),
  ];

  const order = await prisma.order.findFirst({
    where: {
      stripeSessionId: sessionId,
      ...(orClauses.length ? { OR: orClauses } : {}),
    },
    include: {
      items: {
        // ✅ include BOTH types (no where filter here)
        include: {
          product: { select: { id: true, title: true, thumbnails: true } },
          digitalVariant: { select: { id: true, license: true, format: true } },
          printVariant: {
            select: { id: true, format: true, size: true, material: true, frame: true },
          },
        },
      },
      downloadTokens: { include: { asset: true } },
    },
  });

  if (!order) {
    return NextResponse.json({
      hasDigital: false,
      hasPrint: false,
      order: null,
      digitalDownloads: [],
    });
  }

  // ---------- Build a compact, UI-friendly order ----------
  const orderItems = order.items.map((it) => ({
    id: it.id,
    type: it.type as "DIGITAL" | "PRINT",
    price: it.price,
    quantity: it.quantity,
    myProduct: {
      id: it.productId,
      title: it.product?.title ?? "Artwork",
      imageUrl: it.product?.thumbnails?.[0] ?? null,
      digital:
        it.type === "DIGITAL" && it.digitalVariant
          ? {
              id: it.digitalVariant.id,
              format: it.digitalVariant.format ?? "",
              license: it.digitalVariant.license ?? undefined,
            }
          : undefined,
      print:
        it.type === "PRINT" && it.printVariant
          ? {
              id: it.printVariant.id,
              format: it.printVariant.format ?? "",
              size: it.printVariant.size ?? "",
              material: it.printVariant.material ?? "",
              frame: it.printVariant.frame ?? "",
            }
          : undefined,
    },
  }));

  const hasDigital = orderItems.some((i) => i.type === "DIGITAL");
  const hasPrint = orderItems.some((i) => i.type === "PRINT");

  // ---------- Digital downloads (from tokens) ----------
  // Map productId -> title & license (license only from DIGITAL lines)
  const titleByProduct = new Map<string, string>();
  const licenseByProduct = new Map<string, string>();

  for (const it of order.items) {
    if (it.productId && it.product?.title) {
      titleByProduct.set(it.productId, it.product.title);
    }
    if (it.type === VariantType.DIGITAL && it.productId && it.digitalVariant?.license) {
      licenseByProduct.set(it.productId, it.digitalVariant.license);
    }
  }

  const digitalDownloads = (order.downloadTokens ?? []).map((t) => {
    const a = t.asset!;
    const title = titleByProduct.get(a.productId) ?? "Artwork";
    const license = licenseByProduct.get(a.productId) ?? t.licenseSnapshot ?? "Personal";
    return {
      id: a.id,
      title,
      format: a.ext,
      downloadUrl: t.signedUrl,
      previewUrl: a.previewUrl ?? undefined,
      width: a.width ?? undefined,
      height: a.height ?? undefined,
      dpi: a.dpi ?? undefined,
      colorProfile: a.colorProfile ?? undefined,
      sizeBytes: a.sizeBytes ?? undefined,
      license,
      isVector: a.isVector,
      checksum: a.checksum ?? undefined,
      expiresAt: t.expiresAt.toISOString(),
      remainingUses: t.remainingUses ?? null,
    };
  });

  return NextResponse.json({
    hasDigital,
    hasPrint,
    order: {
      id: order.id,
      placedAt: order.placedAt.toISOString(),
      total: order.total,
      items: orderItems,
    },
    digitalDownloads,
  });
}
