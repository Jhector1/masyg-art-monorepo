// File: src/app/api/orders/[orderId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import type { Storefront } from "@prisma/client";

function resolveSite(req: NextRequest): Storefront {
  const fromHeader = req.headers.get("x-storefront")?.toUpperCase();
  const fromQuery = req.nextUrl.searchParams.get("site")?.toUpperCase();
  const raw = (fromHeader || fromQuery) as Storefront | undefined;
  return raw === "JEANYVES" ? "JEANYVES" : "ZILEDIGITAL";
}

function noCache() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function GET(req: NextRequest, ctx: { params: { orderId: string } }) {
  const site = "JEANYVES";
 const { userId, guestId } = await getPrincipalFromRequest(req, authOptions);

  if (!userId && !guestId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noCache() });
  }

  const orderId = String(ctx.params.orderId);

  const ownerWhere = userId
    ? { userId: String(userId) }
    : { guestId: String(guestId) };

  const order = await prisma.order.findFirst({
    where: { id: orderId, site, ...ownerWhere },
    select: {
      id: true,
      site: true,
      status: true,
      total: true,
      placedAt: true,
      updatedAt: true,
      stripeSessionId: true,
      userId: true,
      guestId: true,
      shipping: {
        select: {
          id: true,
          label: true,
          street: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          createdAt: true,
        },
      },
      payment: {
        select: {
          status: true,
          amount: true,
          provider: true,
          transactionId: true,
          createdAt: true,
        },
      },
      items: {
        select: {
          id: true,
          type: true,
          quantity: true,
          price: true,
          listPrice: true,
          previewUrlSnapshot: true,
          product: {
            select: { id: true, title: true, thumbnails: true, description: true },
          },
          originalVariant: {
            select: {
              id: true,
              status: true,
              originalSerial: true,
              medium: true,
              year: true,
              widthIn: true,
              heightIn: true,
              depthIn: true,
              framed: true,
              weightLb: true,
              soldAt: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noCache() });
  }

  return NextResponse.json({ site, order }, { status: 200, headers: noCache() });
}
