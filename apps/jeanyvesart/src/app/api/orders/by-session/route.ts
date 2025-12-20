export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@acme/core/lib/prisma";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

const SITE = "JEANYVES" as const;

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id") || "";
    const claim = searchParams.get("claim") || "";

    if (!sessionId) {
      return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
    }

    const { userId, guestId } = await getCustomerIdFromRequest(req);

    const order = await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      include: {
        shipping: true,
        items: {
          include: {
            product: { select: { title: true, thumbnails: true } },
            originalVariant: true,
          },
        },
      },
    });

    if (!order || order.site !== SITE) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }

    // Access rules:
    // 1) Owner (userId/guestId) can view
    // 2) OR valid claim token can view (for guest claiming)
    const isOwner =
      (userId && order.userId && userId === order.userId) ||
      (guestId && order.guestId && guestId === order.guestId);

    const now = new Date();
    const claimOk =
      Boolean(claim) &&
      Boolean(order.claimTokenHash) &&
      Boolean(order.claimTokenExpiresAt) &&
      order.claimTokenExpiresAt! > now &&
      sha256Hex(claim) === order.claimTokenHash;

    if (!isOwner && !claimOk) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const canClaim =
      Boolean(order.guestId) &&
      !order.userId &&
      Boolean(order.claimTokenHash) &&
      Boolean(order.claimTokenExpiresAt) &&
      order.claimTokenExpiresAt! > now;

    // Shape a clean payload for UI
    const payload = {
      id: order.id,
      status: order.status,
      total: order.total,
      placedAt: order.placedAt,
      site: order.site,
      shipping: order.shipping
        ? {
            label: order.shipping.label,
            street: order.shipping.street,
            city: order.shipping.city,
            state: order.shipping.state,
            postalCode: order.shipping.postalCode,
            country: order.shipping.country,
          }
        : null,
      items: order.items.map((it) => ({
        id: it.id,
        type: it.type,
        price: it.price,
        quantity: it.quantity,
        previewUrl:
          it.previewUrlSnapshot ||
          it.product?.thumbnails?.[0] ||
          null,
        product: {
          id: it.productId,
          title: it.product?.title ?? "Artwork",
        },
        original: it.originalVariant
          ? {
              id: it.originalVariant.id,
              status: it.originalVariant.status,
              medium: it.originalVariant.medium,
              year: it.originalVariant.year,
              widthIn: it.originalVariant.widthIn,
              heightIn: it.originalVariant.heightIn,
              depthIn: it.originalVariant.depthIn,
              framed: it.originalVariant.framed,
              originalSerial: it.originalVariant.originalSerial,
              soldAt: it.originalVariant.soldAt,
            }
          : null,
      })),
      canClaim: canClaim && claimOk, // only show claim UX if they have the link
      processing:
        order.status === "PENDING" || !order.shipping, // webhook may still be running
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("[ORDER_BY_SESSION_ERROR]", err?.message || err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
