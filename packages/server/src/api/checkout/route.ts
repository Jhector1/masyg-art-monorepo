// File: src/app/api/checkout/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@acme/core/lib/stripe";
import { prisma } from "@acme/core/lib/prisma";
import type { OrderList } from "@acme/core/types";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { applyBundleIfBoth, computeBaseUnit, getEffectiveSale, roundMoney } from "@acme/core/lib/pricing";
// import { getSizeMultiplier } from "@/utils/helpers";

/** Latest UserDesign for a given (user|guest)+productId */
async function findDesign(productId: string, userId: string | null, guestId: string | null) {
  if (!userId && !guestId) return null;
  return prisma.userDesign.findFirst({
    where: userId ? { userId, productId } : { guestId: guestId!, productId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, previewUrl: true, previewPublicId: true },
  });
}

/** Fallback: detect digital/print selection shape from body.myProduct (used only if cartItemId missing) */
function detectDigital(p: any) {
  const obj = p?.digital;
  const id =(typeof obj === "object" && obj?.id) || null;
  const present = Boolean(id) || obj === true || obj === "Digital" || obj === "DIGITAL";
  const format = (typeof obj === "object" && obj?.format) || undefined;
  const license = (typeof obj === "object" && obj?.license)  || undefined;
  return { present, id, format, license };
}
function detectPrint(p: any) {
  const obj = p?.print;
  const id = obj?.id || (typeof obj === "object" && obj?.id) || null;
  const present = Boolean(id) || obj === true || obj === "Print" || obj === "PRINT";
  const format = (typeof obj === "object" && obj?.format) || undefined;
  const size = (typeof obj === "object" && obj?.size) || undefined;
  const material = (typeof obj === "object" && obj?.material) || undefined;
  const frame = (typeof obj === "object" && obj?.frame) || undefined;
  return { present, id, format, size, material, frame };
}

export async function POST(req: NextRequest) {
  try {
    const { userId, guestId } = await getCustomerIdFromRequest(req);
    const body = (await req.json()) as OrderList;

    if (!Array.isArray(body?.cartProductList)) {
      return NextResponse.json({ error: "cartProductList missing/invalid" }, { status: 400 });
    }

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const purchasedCartItemIds: string[] = [];
    let requiresShipping = false;
    let hasAnyDesign = false;

    // Prefer server data by cartItemId; fallback to safe compute from product+selection
    const requestedIds = body.cartProductList.map(i => String(i.cartItemId ?? "")).filter(Boolean);

    const cartItems = requestedIds.length
      ? await prisma.cartItem.findMany({
          where: { id: { in: requestedIds } },
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
                    sizes: true, // ← ADD

              },
            },
            digitalVariant: true,
            printVariant: true,
            design: { select: { id: true, previewUrl: true } },
            // NOTE: scalar fields (previewUrlSnapshot, styleSnapshot) are included by default
          },
        })
      : [];


    // Quick lookup for cartItems by id
    const cartById = new Map(cartItems.map(ci => [ci.id, ci]));

    for (const entry of body.cartProductList) {
      console.log(entry)
        // const digitalt = detectDigital(entry.myProduct);
      // const printt = detectPrint(entry.myProduct);

      console.log("digital", cartItems)
      //       console.log("print", printt)
      const qty = Math.max(1, Number(entry.quantity ?? 1));

      // Server-only detection for "user design" on known cart lines
      const ciFromMap = entry.cartItemId ? cartById.get(entry.cartItemId) : null;
      const serverSawDesign =
        Boolean(ciFromMap?.design?.id) ||
        Boolean((ciFromMap as any)?.styleSnapshot) ||
        Boolean((ciFromMap as any)?.previewUrlSnapshot);

      hasAnyDesign ||= serverSawDesign;

      //  console.log("digital-----", digitalt)
       

      // 1) If we have a server cart line, use it as the single source of truth
      if (entry.cartItemId && ciFromMap) {
        const ci = ciFromMap;
        const product = ci.product;
        const digitalVariant = ci.digitalVariant;
        const printVariant = ci.printVariant;

        // server-side price derivation
        const baseUnit = computeBaseUnit({
          productBase: product.price,
          format: digitalVariant?.format ?? printVariant?.format,
          size: printVariant?.size,
          material: printVariant?.material,
          frame: printVariant?.frame,
          license: digitalVariant?.license,
          digital: digitalVariant,
          print: printVariant,
            sizeList: product.sizes,     // ← NEW

        });
        // Use moderated size multiplier (same as cart)
// const sizeFactor =
//   printVariant?.size
//     ? getSizeMultiplier(String(printVariant.size), product.sizes ?? undefined)
//     : 1;

// const baseUnit = roundMoney(baseUnitRaw * sizeFactor);



        const sale = getEffectiveSale({
          price: baseUnit,
          salePrice: product.salePrice,
          salePercent: product.salePercent,
          saleStartsAt: product.saleStartsAt,
          saleEndsAt: product.saleEndsAt,
        });

        const priceWithBundle = applyBundleIfBoth(baseUnit, digitalVariant, printVariant);
        const priceWithSale = sale.price;
        const finalUnit = roundMoney(Math.min(priceWithSale, priceWithBundle));
        const unitCents = Math.round(finalUnit * 100);

        // split (for webhook orderItem splitting)
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
        if (printVariant) requiresShipping = true;

        line_items.push({
          price_data: {
            currency: "usd",
            unit_amount: unitCents,
            product_data: {
              name: product.title,
              ...(imageUrl ? { images: [imageUrl] } : {}),
              metadata: {
                productId: product.id,
                variantType:
                  digitalVariant && printVariant ? "BUNDLE" : (digitalVariant ? "DIGITAL" : "PRINT"),
                ...(digitalVariant && {
                  digitalVariantId: digitalVariant.id,
                  digitalFormat: digitalVariant.format ?? "",
                  ...(typeof digitalUnitCents === "number" ? { digitalUnitCents: String(digitalUnitCents) } : {}),
                }),
                ...(printVariant && {
                  printVariantId: printVariant.id,
                  printFormat: printVariant.format ?? "",
                  ...(printVariant.size ? { printSize: String(printVariant.size) } : {}),
                  ...(printVariant.material ? { printMaterial: String(printVariant.material) } : {}),
                  ...(printVariant.frame ? { printFrame: String(printVariant.frame) } : {}),
                  ...(typeof printUnitCents === "number" ? { printUnitCents: String(printUnitCents) } : {}),
                }),
                ...(ci.design?.id ? { designId: String(ci.design.id) } : {}),
                ...(serverSawDesign ? { isDesignOrder: "1" } : {}),
                ...(userId ? { userId } : {}),
                ...(guestId ? { guestId } : {}),
                cartItemId: ci.id,
              },
            },
          },
          quantity: qty,
        });

        purchasedCartItemIds.push(ci.id);
        continue;
      }

      // 2) Fallback (no cartItemId): compute from product + selection, still server-authoritative
      const p = (entry as any).myProduct as any;
      //    const digitalt = detectDigital(p);
      // const printt = detectPrint(p);

      //       console.log("print", printt)
      if (!p?.id || !p?.title) continue;

      // fetch product to get server sale fields
      const product = await prisma.product.findUnique({
        where: { id: String(p.id) },
        select: {
          id: true,
          title: true,
          price: true,
          thumbnails: true,
          salePrice: true,
          salePercent: true,
          saleStartsAt: true,
          saleEndsAt: true,
              sizes: true, // ← ADD

        },
      });
      if (!product) continue;

      const digital = detectDigital(p);
      const print = detectPrint(p);

      console.log("digital", digital)
            console.log("print", print)


      // shape minimal "variants" for pricing
      const digitalVariant = digital.present
        ? { id: digital.id ?? "tmp", type: "DIGITAL", format: digital.format, license: digital.license }
        : null;
      const printVariant = print.present
        ? { id: print.id ?? "tmp", type: "PRINT", format: print.format, size: print.size, material: print.material, frame: print.frame }
        : null;

      // derive price on server
      const baseUnit = computeBaseUnit({
        productBase: product.price,
        format: digitalVariant?.format ?? printVariant?.format,
        size: printVariant?.size,
        material: printVariant?.material,
        frame: printVariant?.frame,
        license: digitalVariant?.license,
        digital: digitalVariant as any,
        print: printVariant as any,
          sizeList: product.sizes,     // ← NEW

      });
// const sizeFactor =
//   printVariant?.size
//     ? getSizeMultiplier(String(printVariant.size), product.sizes ?? undefined)
//     : 1;

// const baseUnit = roundMoney(baseUnitRaw * sizeFactor);

      const sale = getEffectiveSale({
        price: baseUnit,
        salePrice: product.salePrice,
        salePercent: product.salePercent,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
      });

      const priceWithBundle = applyBundleIfBoth(baseUnit, digitalVariant, printVariant);
      const priceWithSale = sale.price;
      const finalUnit = roundMoney(Math.min(priceWithSale, priceWithBundle));
      const unitCents = Math.round(finalUnit * 100);

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

      const design = await findDesign(product.id, userId ?? null, guestId ?? null);
      const serverSawDesignFallback = Boolean(design);
      hasAnyDesign ||= serverSawDesignFallback;
      if (printVariant) requiresShipping = true;

      const imageUrl = design?.previewUrl || p.imageUrl || product.thumbnails?.[0];

      line_items.push({
        price_data: {
          currency: "usd",
          unit_amount: unitCents,
          product_data: {
            name: product.title,
            ...(imageUrl ? { images: [imageUrl] } : {}),
            metadata: {
              productId: product.id,
              variantType: digitalVariant && printVariant ? "BUNDLE" : (digitalVariant ? "DIGITAL" : "PRINT"),
              ...(digitalVariant && {
                digitalVariantId: String(digitalVariant.id ?? ""),
                digitalFormat: digitalVariant.format ?? "",
                ...(typeof digitalUnitCents === "number" ? { digitalUnitCents: String(digitalUnitCents) } : {}),
              }),
              ...(printVariant && {
                printVariantId: String(printVariant.id ?? ""),
                printFormat: printVariant.format ?? "",
                ...(printVariant.size ? { printSize: String(printVariant.size) } : {}),
                ...(printVariant.material ? { printMaterial: String(printVariant.material) } : {}),
                ...(printVariant.frame ? { printFrame: String(printVariant.frame) } : {}),
                ...(typeof printUnitCents === "number" ? { printUnitCents: String(printUnitCents) } : {}),
              }),
              ...(design?.id ? { designId: String(design.id) } : {}),
              ...(serverSawDesignFallback ? { isDesignOrder: "1" } : {}),
              ...(userId ? { userId } : {}),
              ...(guestId ? { guestId } : {}),
            },
          },
        },
        quantity: qty,
      });
       const design2 = await findDesign(p.id, userId ?? null, guestId ?? null);
      if (design2) hasAnyDesign = true;

    }

    if (line_items.length === 0) {
      return NextResponse.json(
        { error: "no_purchasable_items", message: "No valid selections or non-zero prices found." },
        { status: 400 }
      );
    }

    const sessionMetadata: Stripe.MetadataParam = {
      kind: "order",
      ...(userId && { userId }),
      ...(guestId && { guestId }),
      ...(purchasedCartItemIds.length && { cartItemIds: purchasedCartItemIds.join(",") }),
    };

    // // Final source of truth: if any line item has a design marker -> Embedded
    // hasAnyDesign ||= line_items.some((li) => {
    //   const md = (li.price_data as any)?.product_data?.metadata as Record<string, string> | undefined;
    //   return Boolean(md?.designId) || md?.isDesignOrder === "1";
    // });

    if (hasAnyDesign) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded",
        redirect_on_completion: "never",
        line_items,
        ...(requiresShipping
          ? { shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "FR"] } }
          : {}),
        consent_collection: { terms_of_service: "required" },
        automatic_tax: { enabled: true },
        metadata: sessionMetadata,
        client_reference_id: `order:${userId ?? guestId ?? "guest"}`,
      });

      return NextResponse.json({
        flow: "embedded",
        clientSecret: session.client_secret,
        sessionId: session.id,
      });
    }

    const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL!;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${CLIENT_URL}/cart/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/cart`,
      line_items,
      ...(requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "FR"] } }
        : {}),
      consent_collection: { terms_of_service: "required" },
      automatic_tax: { enabled: true },
      metadata: sessionMetadata,
      client_reference_id: `order:${userId ?? guestId ?? "guest"}`,
    });

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
