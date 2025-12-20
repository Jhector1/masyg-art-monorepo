export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@acme/core/lib/stripe";
import { prisma } from "@acme/core/lib/prisma";

const SITE = "JEANYVES" as const;

function normalizeStreet(line1?: string | null, line2?: string | null) {
  return [line1, line2].filter(Boolean).join(" ").trim();
}

async function loadOrderFromSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId || undefined;

  if (orderId) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
  }

  // fallback if metadata was missing
  if (session.id) {
    return prisma.order.findUnique({
      where: { stripeSessionId: session.id },
      include: { items: true },
    });
  }

  return null;
}

async function finalizePaidOrder(session: Stripe.Checkout.Session) {
  const order = await loadOrderFromSession(session);
  if (!order) return;

  // Safety: only handle JEANYVES here
  if (order.site !== SITE) return;

  // quick idempotency guard (still keep the tx-safe guard below)
  if (order.status === "PAID") return;

  await prisma.$transaction(
    async (tx) => {
      // Build original ids once
      const originalIds = order.items
        .map((i) => i.originalVariantId)
        .filter(Boolean) as string[];

      // ---------- Create shipping address only if missing ----------
      let shippingId = order.shippingId ?? null;
     

      const ship = session.shipping_details;
      const addr = ship?.address;
      

      if (!shippingId && addr) {
        const created = await tx.address.create({
          data: {
            userId: order.userId ?? undefined,
            guestId: order.guestId ?? undefined,
            label: "Shipping",
            street: normalizeStreet(addr.line1, addr.line2) || "—",
            city: addr.city || "—",
            state: addr.state || "—",
            postalCode: addr.postal_code || "—",
            country: addr.country || "—",
          },
          select: { id: true },
        });
        shippingId = created.id;
      }

      // ---------- Payment upsert ----------
      const amount = (session.amount_total ?? 0) / 100;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? session.id;

      await tx.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          amount,
          provider: "STRIPE",
          transactionId: paymentIntentId,
          status: "PAID",
        },
        update: {
          amount,
          transactionId: paymentIntentId,
          status: "PAID",
        },
      });

      // ---------- Tx-safe idempotency / race protection ----------
      // If another webhook already marked it paid, this will be count=0 and we stop.
      const paidUpdate = await tx.order.updateMany({
        where: { id: order.id, status: { not: "PAID" } },
        data: {
          status: "PAID",
          shippingId: shippingId ?? undefined,
        },
      });
      if (paidUpdate.count === 0) return; // already handled by another process

      // ---------- Mark originals SOLD ----------
      if (originalIds.length) {
        await tx.productVariant.updateMany({
          where: {
            id: { in: originalIds },
            type: "ORIGINAL",
            // allow either RESERVED (expected) or ACTIVE (safety)
            status: { in: ["RESERVED", "ACTIVE"] },
          },
          data: { status: "SOLD", soldAt: new Date() },
        });

        // ✅ IMPORTANT: remove from ALL carts on this site (not just buyer)
        await tx.cartItem.deleteMany({
          where: {
            originalVariantId: { in: originalIds },
            cart: { site: order.site },
          },
        });
      }
    },
    {
      // optional but recommended if your DB is sometimes slow
      timeout: 20000,
      maxWait: 10000,
    }
  );
}


async function releaseReservedOrder(session: Stripe.Checkout.Session) {
  const order = await loadOrderFromSession(session);
  if (!order) return;
  if (order.site !== SITE) return;

  // Only release if still pending
  if (order.status !== "PENDING") return;

  await prisma.$transaction(async (tx) => {
    const originalIds = order.items
      .map((i) => i.originalVariantId)
      .filter(Boolean) as string[];

    if (originalIds.length) {
      await tx.productVariant.updateMany({
        where: {
          id: { in: originalIds },
          type: "ORIGINAL",
          status: "RESERVED",
        },
        data: { status: "ACTIVE" },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "EXPIRED" },
    });
  });
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const rawBody = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.NEXT_STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[STRIPE_WEBHOOK_SIGNATURE_ERROR]", err?.message || err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency guard (your schema has WebhookEvent { id })
  const already = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (already) return NextResponse.json({ received: true });

  await prisma.webhookEvent.create({ data: { id: event.id } });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await finalizePaidOrder(session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await releaseReservedOrder(session);
        break;
      }
      default:
        break;
    }
  } catch (err: any) {
    console.error("[STRIPE_WEBHOOK_HANDLER_ERROR]", event.type, err?.message || err);
    // Return 200 so Stripe doesn't retry forever if the failure is non-recoverable,
    // BUT if you prefer retries, change to 500.
  }

  return NextResponse.json({ received: true });
}
