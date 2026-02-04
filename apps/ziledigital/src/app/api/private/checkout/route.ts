// File: src/app/api/private/checkout/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@acme/core/lib/stripe";
import { prisma } from "@acme/core/lib/prisma";
import type { OrderList } from "@acme/core/types";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

import {
  applyBundleIfBoth,
  computeBaseUnit,
  getEffectiveSale,
  roundMoney,
} from "@acme/core/lib/pricing";

function moneyCents(n: number) {
  // Stripe expects integer cents
  return Math.max(0, Math.round(roundMoney(n) * 100));
}

async function readJsonSafe<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Must have an actor (logged in OR guest cookie)
    const { userId, guestId } = await getCustomerIdFromRequest(req);
    if (!userId && !guestId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonSafe<OrderList>(req);
    if (!body || !Array.isArray((body as any)?.cartProductList)) {
      return NextResponse.json(
        { error: "cartProductList missing/invalid" },
        { status: 400 }
      );
    }

    // ✅ Anti-abuse
    if (body.cartProductList.length > 25) {
      return NextResponse.json({ error: "too_many_items" }, { status: 400 });
    }

    // ✅ Require cartItemId for every entry (server-authoritative checkout)
    const requestedIds = body.cartProductList
      .map((i: any) => String(i?.cartItemId ?? ""))
      .filter(Boolean);

    if (requestedIds.length !== body.cartProductList.length) {
      return NextResponse.json(
        { error: "cartItemId_required" },
        { status: 400 }
      );
    }

    // ✅ Load ONLY cart items belonging to this actor (CRITICAL)
    const cartItems = await prisma.cartItem.findMany({
      where: {
        id: { in: requestedIds },
        cart: userId ? { userId } : { guestId: guestId! },
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            thumbnails: true,
            salePrice: true,
            salePercent: true,
            saleStartsAt: true,
            saleEndsAt: true,
            sizes: true,
          },
        },
        digitalVariant: true,
        printVariant: true,
        design: { select: { id: true, previewUrl: true } },
        // NOTE: scalar fields (previewUrlSnapshot, styleSnapshot) are included by default in Prisma
      },
    });

    // If any ids are missing, reject (prevents probing or stale ids)
    if (cartItems.length !== requestedIds.length) {
      return NextResponse.json(
        { error: "cart_item_not_found_or_not_owned" },
        { status: 404 }
      );
    }

    const cartById = new Map(cartItems.map((ci) => [ci.id, ci]));

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const purchasedCartItemIds: string[] = [];
    let requiresShipping = false;
    let hasAnyDesign = false;

    // Build Stripe line items from server cart
    for (const entry of body.cartProductList as any[]) {
      const ci = cartById.get(String(entry.cartItemId));
      if (!ci) continue;

      const qtyRaw = Number(entry?.quantity ?? 1);
      const qty = Math.max(1, Math.min(10, Number.isFinite(qtyRaw) ? qtyRaw : 1));

      const product = ci.product;
      const digitalVariant = ci.digitalVariant;
      const printVariant = ci.printVariant;

      const serverSawDesign =
        Boolean(ci.design?.id) ||
        Boolean((ci as any)?.styleSnapshot) ||
        Boolean((ci as any)?.previewUrlSnapshot);

      hasAnyDesign ||= serverSawDesign;
      if (printVariant) requiresShipping = true;

      // ✅ Server-side price derivation
      const baseUnit = computeBaseUnit({
        productBase: product.price,
        format: digitalVariant?.format ?? printVariant?.format,
        size: printVariant?.size,
        material: printVariant?.material,
        frame: printVariant?.frame,
        license: digitalVariant?.license,
        digital: digitalVariant,
        print: printVariant,
        sizeList: product.sizes,
      });

      const sale = getEffectiveSale({
        price: baseUnit,
        salePrice: product.salePrice,
        salePercent: product.salePercent,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
      });

      const priceWithBundle = applyBundleIfBoth(baseUnit, digitalVariant, printVariant);
      const finalUnit = roundMoney(Math.min(sale.price, priceWithBundle));
      const unitCents = moneyCents(finalUnit);

      // Split cents for bookkeeping in webhook (optional but useful)
      let digitalUnitCents: number | undefined;
      let printUnitCents: number | undefined;
      if (digitalVariant && printVariant) {
        digitalUnitCents = Math.floor(unitCents / 2);
        printUnitCents = unitCents - digitalUnitCents;
      } else if (digitalVariant) {
        digitalUnitCents = unitCents;
      } else if (printVariant) {
        printUnitCents = unitCents;
      }

      const imageUrl = ci.design?.previewUrl || product.thumbnails?.[0];

      line_items.push({
        price_data: {
          currency: "usd",
          unit_amount: unitCents,
          product_data: {
            name: product.title,
            ...(imageUrl ? { images: [imageUrl] } : {}),
            metadata: {
              productId: product.id,
              cartItemId: ci.id,
              variantType:
                digitalVariant && printVariant
                  ? "BUNDLE"
                  : digitalVariant
                  ? "DIGITAL"
                  : "PRINT",

              ...(digitalVariant && {
                digitalVariantId: digitalVariant.id,
                digitalFormat: digitalVariant.format ?? "",
                ...(typeof digitalUnitCents === "number"
                  ? { digitalUnitCents: String(digitalUnitCents) }
                  : {}),
              }),

              ...(printVariant && {
                printVariantId: printVariant.id,
                printFormat: printVariant.format ?? "",
                ...(printVariant.size ? { printSize: String(printVariant.size) } : {}),
                ...(printVariant.material ? { printMaterial: String(printVariant.material) } : {}),
                ...(printVariant.frame ? { printFrame: String(printVariant.frame) } : {}),
                ...(typeof printUnitCents === "number"
                  ? { printUnitCents: String(printUnitCents) }
                  : {}),
              }),

              ...(ci.design?.id ? { designId: String(ci.design.id) } : {}),
              ...(serverSawDesign ? { isDesignOrder: "1" } : {}),
              // 🚫 do NOT put userId/guestId here
            },
          },
        },
        quantity: qty,
      });

      purchasedCartItemIds.push(ci.id);
    }

    if (line_items.length === 0) {
      return NextResponse.json(
        {
          error: "no_purchasable_items",
          message: "No valid selections found.",
        },
        { status: 400 }
      );
    }

    // ✅ Session-level metadata (OK to include actor here)
    const sessionMetadata: Stripe.MetadataParam = {
      kind: "order",
      ...(userId && { userId }),
      ...(guestId && { guestId }),
      ...(purchasedCartItemIds.length
        ? { cartItemIds: purchasedCartItemIds.join(",") }
        : {}),
    };

    // ✅ Idempotency key prevents double sessions on retries/double-click
    const idemKey = `checkout:${userId ?? guestId}:${purchasedCartItemIds
      .slice()
      .sort()
      .join(",")}`;

    const commonParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items,
      ...(requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "FR"] } }
        : {}),
      consent_collection: { terms_of_service: "required" },
      automatic_tax: { enabled: true },
      metadata: sessionMetadata,
      client_reference_id: `order:${userId ?? guestId ?? "guest"}`,
    };

    // If any line was a design order -> use embedded flow (your logic)
    if (hasAnyDesign) {
      const session = await stripe.checkout.sessions.create(
        {
          ...commonParams,
          ui_mode: "embedded",
          redirect_on_completion: "never",
        },
        { idempotencyKey: idemKey }
      );

      return NextResponse.json({
        flow: "embedded",
        clientSecret: session.client_secret,
        sessionId: session.id,
      });
    }

    const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL!;
    const session = await stripe.checkout.sessions.create(
      {
        ...commonParams,
        payment_method_types: ["card"],
        success_url: `${CLIENT_URL}/cart/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/cart`,
      },
      { idempotencyKey: idemKey }
    );

    return NextResponse.json({
      flow: "redirect",
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("[CHECKOUT_ROUTE_ERROR]", err?.message || err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
