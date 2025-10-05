// File: src/app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { CollectionDigitalAsset, CollectionItem } from "@acme/core/types";

const prisma = new PrismaClient();

/**
 * GET /api/orders?type=ALL|DIGITAL|PRINT
 * Returns groups of order items keyed by YYYY-MM-DD date with download-ready metadata.
 */
export async function GET(req: NextRequest) {
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  const url = new URL(req.url);
  const typeParam = (url.searchParams.get("type") || "ALL").toUpperCase();

  const whereType =
    typeParam === "DIGITAL" || typeParam === "PRINT"
      ? { type: typeParam as "DIGITAL" | "PRINT" }
      : {};

  const items = await prisma.orderItem.findMany({
    where: {
      ...whereType,
      order: {
        ...(userId ? { userId } : {}),
        ...(guestId ? { guestId } : {}),
      },
    },
    include: {
      order: { select: { placedAt: true, stripeSessionId: true, status: true } },
      product: { select: { id: true, title: true, thumbnails: true } },
      digitalVariant: { select: { id: true, format: true, license: true, size: true } },
      printVariant: { select: { id: true, size: true, material: true, frame: true } },
      purchasedDesign: { select: { id: true, previewUrl: true } },
      downloadTokens: {
        where: {
          expiresAt: { gt: new Date() },
          OR: [{ remainingUses: null }, { remainingUses: { gt: 0 } }],
        },
        orderBy: { createdAt: "desc" },
        include: {
          asset: {
            select: {
              url: true,
              previewUrl: true,
              mimeType: true,
              ext: true,
              isVector: true,
              width: true,
              height: true,
              dpi: true,
              colorProfile: true,
              sizeBytes: true,
              hasAlpha: true,
            },
          },
        },
      },
    },
    orderBy: { order: { placedAt: "desc" } },
  });


  const shaped: Record<string, CollectionItem[]> = {};

  for (const it of items) {
    const dateKey = it.order.placedAt.toISOString().slice(0, 10);

    const tokens: CollectionDigitalAsset[] = it.downloadTokens.map((dt) => ({
      tokenId: dt.id,
      url: dt.signedUrl,
      ext: dt.asset.ext,
      width: dt.asset.width,
      height: dt.asset.height,
      dpi: dt.asset.dpi,
      sizeBytes: dt.asset.sizeBytes,
      colorProfile: dt.asset.colorProfile,
      isVector: dt.asset.isVector,
      hasAlpha: dt.asset.hasAlpha,
    }));

    const previewUrl =
      it.purchasedDesign?.previewUrl ||
      it.previewUrlSnapshot ||
      it.product.thumbnails[0] ||
      it.downloadTokens[0]?.asset.previewUrl ||
      null;

    const entry: CollectionItem = {
      id: it.id,
      type: it.type as "DIGITAL" | "PRINT",
      price: it.price,
      quantity: it.quantity,
      order: {
        isUserDesign: it.purchasedDesign?true: false,
        placedAt: it.order.placedAt.toISOString(),
        stripeSessionId: it.order.stripeSessionId,
        status: it.order.status,
      },
      product: it.product,
      previewUrl,
      ...(it.type === "DIGITAL"
        ? {
            digital: {
              variantId: it.digitalVariant?.id ?? null,
              format: it.digitalVariant?.format ?? null,
              license: it.digitalVariant?.license ?? null,
              size: it.digitalVariant?.size ?? null,
              tokens,
            },
          }
        : {
            print: {
              variantId: it.printVariant?.id ?? null,
              size: it.printVariant?.size ?? null,
              material: it.printVariant?.material ?? null,
              frame: it.printVariant?.frame ?? null,
            },
          }),
    };

    (shaped[dateKey] ||= []).push(entry);
  }

  return NextResponse.json(shaped);
}
