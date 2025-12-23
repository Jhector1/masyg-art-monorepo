// File: src/app/api/checkout/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import crypto from "crypto";

import { stripe } from "@acme/core/lib/stripe";
import { prisma } from "@acme/core/lib/prisma";
import { getPrincipalFromRequest } from "@acme/auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveSale, roundMoney } from "@acme/core/lib/pricing";
import { getOrCreateGuestId } from "@acme/auth";

const SITE = "JEANYVES" as const;

function moneyToCents(v: number) {
  return Math.max(0, Math.round(v * 100));
}

type CheckoutEntry =
  | { cartItemId: string; quantity?: number }
  | { productId: string; originalVariantId: string; quantity?: number };

export async function POST(req: NextRequest) {
  try {
let { userId, guestId } = await getPrincipalFromRequest(req, authOptions);
    if (!userId && !guestId) {
      guestId = getOrCreateGuestId();
    }

    const body = (await req.json().catch(() => null)) as any;
    const list: CheckoutEntry[] = body?.cartProductList;

    if (!Array.isArray(list) || list.length === 0) {
      return NextResponse.json(
        { error: "cartProductList missing/invalid" },
        { status: 400 }
      );
    }

    // normalize + enforce qty=1 for originals
    const normalized = list.map((e: any) => ({
      cartItemId: e?.cartItemId ? String(e.cartItemId) : null,
      productId: e?.productId ? String(e.productId) : null,
      originalVariantId: e?.originalVariantId
        ? String(e.originalVariantId)
        : null,
      qty: 1,
    }));

    const cartItemIds = normalized
      .map((x) => x.cartItemId)
      .filter(Boolean) as string[];
    const directPairs = normalized
      .filter((x) => !x.cartItemId && x.productId && x.originalVariantId)
      .map((x) => ({
        productId: x.productId!,
        originalVariantId: x.originalVariantId!,
      }));

    if (cartItemIds.length === 0 && directPairs.length === 0) {
      return NextResponse.json(
        {
          error: "invalid_payload",
          message: "Provide cartItemId OR (productId + originalVariantId).",
        },
        { status: 400 }
      );
    }

    // 1) load cart items (server source of truth)
    const cartItems = cartItemIds.length
      ? await prisma.cartItem.findMany({
          where: {
            id: { in: cartItemIds },
            cart: userId
              ? { userId, site: SITE }
              : { guestId: guestId!, site: SITE },
          },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                thumbnails: true,
                site: true,
                price: true,
                salePrice: true,
                salePercent: true,
                saleStartsAt: true,
                saleEndsAt: true,
              },
            },
            originalVariant: true,
            design: { select: { id: true, previewUrl: true } },
          },
        })
      : [];

    const cartById = new Map(cartItems.map((ci) => [ci.id, ci]));

    // 2) load direct “buy now” items (no cart needed)
    const directLoaded = await Promise.all(
      directPairs.map(async ({ productId, originalVariantId }) => {
        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            title: true,
            thumbnails: true,
            site: true,
            price: true,
            salePrice: true,
            salePercent: true,
            saleStartsAt: true,
            saleEndsAt: true,
          },
        });

        const variant = await prisma.productVariant.findUnique({
          where: { id: originalVariantId },
          select: {
            id: true,
            productId: true,
            type: true,
            status: true,
            listPrice: true,
            medium: true,
            year: true,
            widthIn: true,
            heightIn: true,
            originalSerial: true,
          },
        });

        return { product, variant };
      })
    );

    // Build unified checkout items (cart-based or direct)
    const items = [];

    // from cart
    for (const id of cartItemIds) {
      const ci = cartById.get(id);
      if (!ci) {
        return NextResponse.json(
          { error: "invalid_cart_item", message: `Missing cartItemId ${id}` },
          { status: 400 }
        );
      }
      if (ci.product.site !== SITE) {
        return NextResponse.json({ error: "wrong_site" }, { status: 400 });
      }
      if (
        !ci.originalVariantId ||
        !ci.originalVariant ||
        ci.originalVariant.type !== "ORIGINAL"
      ) {
        return NextResponse.json({ error: "not_original" }, { status: 400 });
      }
      if (ci.originalVariant.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "unavailable", message: "Original is not available." },
          { status: 409 }
        );
      }

      items.push({
        productId: ci.productId,
        title: ci.product.title,
        imageUrl:
          ci.previewUrlSnapshot ||
          ci.design?.previewUrl ||
          ci.product.thumbnails?.[0] ||
          null,
        unitPrice: ci.price, // cart is source of truth here
        originalVariantId: ci.originalVariantId,
      });
    }

    // from direct buy-now
    for (const row of directLoaded) {
      const product = row.product;
      const variant = row.variant;

      if (!product || !variant) {
        return NextResponse.json(
          { error: "invalid_product_or_variant" },
          { status: 400 }
        );
      }
      if (product.site !== SITE) {
        return NextResponse.json({ error: "wrong_site" }, { status: 400 });
      }
      if (variant.productId !== product.id || variant.type !== "ORIGINAL") {
        return NextResponse.json({ error: "not_original" }, { status: 400 });
      }
      if (variant.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "unavailable", message: "Original is not available." },
          { status: 409 }
        );
      }

      const base =
        typeof variant.listPrice === "number"
          ? variant.listPrice
          : product.price;
      const sale = getEffectiveSale({
        price: base,
        salePrice: product.salePrice,
        salePercent: product.salePercent,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
      });
      const finalUnit = roundMoney(sale.price);

      items.push({
        productId: product.id,
        title: product.title,
        imageUrl: product.thumbnails?.[0] || null,
        unitPrice: finalUnit,
        originalVariantId: variant.id,
      });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "no_items" }, { status: 400 });
    }

    // guest claim token for "create account to save purchase"
    const isGuest = Boolean(guestId && !userId);
    const claimToken = isGuest ? crypto.randomBytes(32).toString("hex") : null;
    const claimTokenHash = claimToken
      ? crypto.createHash("sha256").update(claimToken).digest("hex")
      : null;
    const claimTokenExpiresAt = claimToken
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : null;

    // Reserve + create Order + create Stripe session
    // compute totals OUTSIDE tx (fast + no DB)
    const total = items.reduce((sum, i) => sum + i.unitPrice, 0);

    // guest claim token computed OUTSIDE tx too (you already do)
    const RESERVE_MINUTES = 31;
    const now = new Date();
    const reservedUntil = new Date(now.getTime() + RESERVE_MINUTES * 60 * 1000);

    const order = await prisma.$transaction(async (tx) => {
      const originalIds = items.map((i) => i.originalVariantId);

      // 1) create order first (so we have id)
      const createdOrder = await tx.order.create({
        data: {
          userId: userId ?? undefined,
          guestId: guestId ?? undefined,
          total,
          status: "PENDING",
          site: SITE,
          claimTokenHash: claimTokenHash ?? undefined,
          claimTokenExpiresAt: claimTokenExpiresAt ?? undefined,
        },
        select: { id: true, site: true },
      });

      // 2) reserve originals (ACTIVE -> RESERVED)
      const reserved = await tx.productVariant.updateMany({
        where: {
          id: { in: originalIds },
          type: "ORIGINAL",
          status: "ACTIVE",
        },
        data: {
          status: "RESERVED",
          reservedAt: now,
          reservedUntil,
          reservedOrderId: createdOrder.id,
        },
      });

      if (reserved.count !== originalIds.length) {
        throw new Error(
          "One or more originals were just taken. Please refresh."
        );
      }

      // 3) order items
      await tx.orderItem.createMany({
        data: items.map((i) => ({
          orderId: createdOrder.id,
          productId: i.productId,
          type: "ORIGINAL",
          price: i.unitPrice,
          quantity: 1,
          previewUrlSnapshot: i.imageUrl ?? null,
          originalVariantId: i.originalVariantId,
        })),
      });

      return createdOrder;
    });

    const CLIENT_URL =
      process.env.NEXT_PUBLIC_CLIENT_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      req.headers.get("origin") ??
      "http://localhost:3000";

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
      items.map((i) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: moneyToCents(i.unitPrice),
          product_data: {
            name: i.title,
            ...(i.imageUrl ? { images: [i.imageUrl] } : {}),
            metadata: {
              site: SITE,
              productId: i.productId,
              variantType: "ORIGINAL",
              originalVariantId: i.originalVariantId,
            },
          },
        },
      }));
    // const RESERVE_MINUTES = 20;
    const expires_at = Math.floor(reservedUntil.getTime() / 1000);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,

      shipping_address_collection: { allowed_countries: ["US", "CA"] },

      consent_collection: { terms_of_service: "required" },
      automatic_tax: { enabled: true },
      expires_at: expires_at, // ✅ required for `checkout.session.expired`

      metadata: {
        kind: "order",
        orderId: order.id,
        site: SITE,
        ...(userId ? { userId } : {}),
        ...(guestId ? { guestId } : {}),
      },

      success_url:
        `${CLIENT_URL}/cart/checkout/success?session_id={CHECKOUT_SESSION_ID}` +
        (claimToken ? `&claim=${claimToken}` : ""),
      cancel_url: `${CLIENT_URL}/cart`,
      client_reference_id: `order:${userId ?? guestId ?? "guest"}`,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripeSessionId: session.id,
        stripeSessionUrl: session.url, // ✅ store this (add field)
        checkoutExpiresAt: reservedUntil, // ✅ store this too (optional)
      },
    });
    return NextResponse.json({
      flow: "redirect",
      url: session.url,
      sessionId: session.id,
      orderId: order.id,
    });
  } catch (err: any) {
    console.error("[CHECKOUT_ROUTE_ERROR]", err?.message || err);
    const msg = String(err?.message ?? "");
    if (msg.includes("just taken")) {
      return NextResponse.json(
        { error: "original_unavailable", message: msg },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
