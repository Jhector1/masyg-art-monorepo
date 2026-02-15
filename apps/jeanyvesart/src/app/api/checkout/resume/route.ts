export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { stripe } from "@acme/core/lib/stripe";
import { getPrincipalFromRequest } from "@acme/auth";
import { authOptions } from "@/lib/auth";

const SITE = "JEANYVES" as const;

export async function GET(req: NextRequest) {
const { userId, guestId } = await getPrincipalFromRequest(req, authOptions);

  // For resume, don't create a new guest identity — if none exists, nothing to resume.
  if (!userId && !guestId) {
    return NextResponse.json({ url: null, reason: "no_identity" }, { status: 404 });
  }

  const now = new Date();

  const order = await prisma.order.findFirst({
    where: {
      site: SITE,
      status: "PENDING",
      ...(userId ? { userId } : { guestId: guestId! }),
    //   checkoutExpiresAt: { gt: now },
      stripeSessionId: { not: null },
    },
    orderBy: { checkoutExpiresAt: "desc" }, // ✅ FIX: was createdAt
    select: {
      id: true,
      stripeSessionId: true,
      stripeSessionUrl: true,
      checkoutExpiresAt: true,
    },
  });
  console.log("Found order for resume:", order); // DEBUG
  if (!order) {
    return NextResponse.json({ url: null, reason: "none" }, { status: 404 });
  }

  // If we already stored it, return it
  if (order.stripeSessionUrl) {
    return NextResponse.json({
      url: order.stripeSessionUrl,
        orderId: order.id,
      expiresAt: order.checkoutExpiresAt,
    });
  }

  // Fallback: retrieve from Stripe if missing
  const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId!);

  if (!session.url) {
    return NextResponse.json({ url: null, reason: "no_url" }, { status: 404 });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionUrl: session.url },
  });
  
return NextResponse.json({
  url: order.stripeSessionUrl ?? session.url,
  orderId: order.id,
  expiresAt: order.checkoutExpiresAt,
});

}
