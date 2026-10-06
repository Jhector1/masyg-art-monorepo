export const runtime = "nodejs";

import type Stripe from "stripe";

import { prisma } from "@acme/core/lib/prisma";
import { createStripeWebhookPostHandler } from "@acme/server/billing/stripe-webhook";

const SITE = "JEANYVES" as const;

function normalizeStreet(line1?: string | null, line2?: string | null) {
  return [line1, line2].filter(Boolean).join(" ").trim();
}

async function loadOrderFromSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId || undefined;

  if (orderId) {
    return prisma.order.findFirst({
      where: { id: orderId, stripeSessionId: session.id, site: SITE },
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

      const ship = session.collected_information?.shipping_details;
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
          : (session.payment_intent?.id ?? session.id);

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
        where: { id: order.id, status: "PENDING" }, // ✅ only PENDING becomes PAID
        data: { status: "PAID", shippingId: shippingId ?? undefined },
      });
      if (paidUpdate.count === 0) return;

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

        // await tx.cartItem.deleteMany({
        //   where: {
        //     originalVariantId: { in: originalIds },
        //     cart: { site: order.site },
        //   },
        // });

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
    status: "RESERVED",
    reservedOrderId: order.id,
  },
  data: {
    status: "ACTIVE",
    reservedAt: null,
    reservedUntil: null,
    reservedOrderId: null,
  },
});

    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "EXPIRED" },
    });
  });
}

export const dynamic = "force-dynamic";

export const POST = createStripeWebhookPostHandler({
  logPrefix: "JEANYVES_STRIPE_WEBHOOK",
  onCheckoutCompleted: async (session) => {
    await finalizePaidOrder(session);
  },
  onCheckoutExpired: async (session) => {
    await releaseReservedOrder(session);
  },
});
