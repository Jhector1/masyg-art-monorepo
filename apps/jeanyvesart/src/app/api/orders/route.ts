// File: src/app/api/orders/route.ts
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

export async function GET(req: NextRequest) {
  const site = "JEANYVES";
 const { userId, guestId } = await getPrincipalFromRequest(req, authOptions);

  if (!userId && !guestId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noCache() });
  }

  const where =
    userId
      ? { site, userId: String(userId) }
      : { site, guestId: String(guestId) };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    select: {
      id: true,
      status: true,
      total: true,
      placedAt: true,
      site: true,
      stripeSessionId: true,
      guestId: true,
      userId: true,
      shipping: {
        select: {
          street: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
        },
      },
      payment: { select: { status: true, provider: true, transactionId: true } },
      items: {
        take: 6,
        select: {
          id: true,
          type: true,
          quantity: true,
          price: true,
          previewUrlSnapshot: true,
          product: {
            select: { id: true, title: true, thumbnails: true },
          },
          originalVariant: {
            select: { id: true, status: true, originalSerial: true, medium: true, year: true },
          },
        },
        orderBy: { id: "desc" },
      },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({ site, orders }, { status: 200, headers: noCache() });
}
