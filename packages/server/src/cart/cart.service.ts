import { prisma } from "@acme/core/lib/prisma";
import {
  VariantType,
  InventoryStatus,
  FulfillmentProvider,
  Prisma,
} from "@prisma/client";
import type { CartSelectedItem, AddToCartBody } from "@acme/core/types";
import { productListSelect } from "@acme/core/types";
import {
  applyBundleIfBoth,
  computeBaseUnit,
  getEffectiveSale,
  roundMoney,
} from "@acme/core/lib/pricing";
import {
  Storefront,
  cartOwnerOr,
  assertStorefrontAllows,
} from "../storefront/storefront";
import { allSizes } from "@acme/core/data/helpers";

/**
 * ✅ Fixes:
 * - Updating DIGITAL/PRINT never creates “extra” variants (updates-in-place when attached).
 * - “ADD” is race-safe (compare-and-swap attach) so rapid UI updates won’t leave duplicates.
 * - When a variant is removed/replaced, it is deleted if orphaned (safe GC).
 * - If both DIGITAL+PRINT removed => cart item removed for that user.
 *
 * IMPORTANT:
 * ProductVariant is NOT per-user. You will still see multiple DIGITAL variants for a product over time,
 * but after this code, they will be either referenced or auto-GC’d (no junk pile).
 */

type Owner = { userId?: string | null; guestId?: string | null };

function assertOwner(owner: Owner) {
  if (!owner.userId && !owner.guestId) throw new Error("Missing userId/guestId");
}

function uniq(ids: (string | null | undefined)[]) {
  return Array.from(new Set(ids.filter(Boolean))) as string[];
}

async function getOrCreateCartId(site: Storefront, owner: Owner) {
  const found = await prisma.cart.findFirst({
    where: { site, OR: cartOwnerOr(owner.userId, owner.guestId) },
    select: { id: true },
  });
  if (found) return found.id;

  const created = await prisma.cart.create({
    data: { site, userId: owner.userId ?? null, guestId: owner.guestId ?? null },
    select: { id: true },
  });
  return created.id;
}

async function getCartId(site: Storefront, owner: Owner) {
  const cart = await prisma.cart.findFirst({
    where: { site, OR: cartOwnerOr(owner.userId, owner.guestId) },
    select: { id: true },
  });
  return cart?.id ?? null;
}

async function findCartItemForProduct(cartId: string, productId: string) {
  // If you truly have exactly one row per (cartId, productId), this returns it.
  // If duplicates exist, it picks the newest (and your GC will still behave safely).
  return prisma.cartItem.findFirst({
    where: { cartId, productId },
    orderBy: { addedAt: "desc" },
    select: { id: true, cartId: true, productId: true, digitalVariantId: true, printVariantId: true },
  });
}

/** ----------------- Variant “cart-origin” tagging + GC ----------------- */

async function markVariantCartOrigin(tx: Prisma.TransactionClient, id: string) {
  const pv = await tx.productVariant.findUnique({
    where: { id },
    select: { id: true, attributes: true },
  });
  if (!pv) return;

  const attrs = (pv.attributes ?? {}) as any;
  if (attrs?.origin === "CART") return;

  await tx.productVariant.update({
    where: { id },
    data: { attributes: { ...attrs, origin: "CART" } as any },
  });
}

async function cleanupCartVariantIfOrphan(id: string) {
  const pv = await prisma.productVariant.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      attributes: true,
      printfulVariantId: true,
      fulfillmentProvider: true,
      soldAt: true,
      sku: true,
      originalSerial: true,
    },
  });
  if (!pv) return;

  const origin = (pv.attributes as any)?.origin ?? null;

  // ✅ Preferred: only delete cart-created variants
  const deletableByOrigin = origin === "CART";

  // ✅ Conservative fallback for legacy “ephemeral” variants you created without attributes
  const deletableLegacyEphemeral =
    origin == null &&
    (pv.type === VariantType.DIGITAL || pv.type === VariantType.PRINT) &&
    pv.printfulVariantId == null &&
    pv.sku == null &&
    pv.originalSerial == null &&
    pv.soldAt == null &&
    (pv.fulfillmentProvider ?? FulfillmentProvider.INTERNAL) ===
      FulfillmentProvider.INTERNAL;

  if (!deletableByOrigin && !deletableLegacyEphemeral) return;

  const cartRefs = await prisma.cartItem.count({
    where: {
      OR: [
        { digitalVariantId: id },
        { printVariantId: id },
        { originalVariantId: id },
      ],
    },
  });

  const orderRefs = await prisma.orderItem.count({
    where: {
      OR: [
        { digitalVariantId: id },
        { printVariantId: id },
        { originalVariantId: id },
      ],
    },
  });

  if (cartRefs === 0 && orderRefs === 0) {
    await prisma.productVariant.delete({ where: { id } }).catch(() => {});
  }
}

/**
 * Race-safe attach:
 * - Create variant
 * - Try to attach only if the cartItem field is still null
 * - If attach failed (another request won), delete the created variant
 */
async function createAndAttachDigitalCAS(args: {
  tx: Prisma.TransactionClient;
  cartItemId: string;
  productId: string;
  format?: string | null;
  license?: string | null;
}) {
  const { tx, cartItemId, productId } = args;

  const created = await tx.productVariant.create({
    data: {
      productId,
      type: VariantType.DIGITAL,
      format: args.format ?? undefined,
      license: args.license ?? undefined,
      status: InventoryStatus.ACTIVE,
      attributes: { origin: "CART" },
    } as any,
    select: { id: true },
  });

  const attached = await tx.cartItem.updateMany({
    where: { id: cartItemId, digitalVariantId: null },
    data: { digitalVariantId: created.id },
  });

  if (attached.count === 0) {
    await tx.productVariant.delete({ where: { id: created.id } }).catch(() => {});
    return null; // someone else attached first
  }

  return created.id;
}

async function createAndAttachPrintCAS(args: {
  tx: Prisma.TransactionClient;
  cartItemId: string;
  productId: string;
  format?: string | null;
  size?: string | null;
  material?: string | null;
  frame?: string | null;
}) {
  const { tx, cartItemId, productId } = args;

  const created = await tx.productVariant.create({
    data: {
      productId,
      type: VariantType.PRINT,
      format: args.format ?? undefined,
      size: args.size ?? undefined,
      material: args.material ?? undefined,
      frame: args.frame ?? undefined,
      status: InventoryStatus.ACTIVE,
      attributes: { origin: "CART" },
    } as any,
    select: { id: true },
  });

  const attached = await tx.cartItem.updateMany({
    where: { id: cartItemId, printVariantId: null },
    data: { printVariantId: created.id },
  });

  if (attached.count === 0) {
    await tx.productVariant.delete({ where: { id: created.id } }).catch(() => {});
    return null;
  }

  return created.id;
}

/** ----------------- Public APIs ----------------- */

export async function isInCart(
  site: Storefront,
  owner: Owner,
  args: {
    productId: string;
    digitalVariantId?: string | null;
    printVariantId?: string | null;
    originalVariantId?: string | null;
  }
) {
  assertOwner(owner);

  const cartId = await getCartId(site, owner);
  if (!cartId) return { inCart: false };

  const item = await prisma.cartItem.findFirst({
    where: {
      cartId,
      productId: args.productId,
      ...(args.digitalVariantId ? { digitalVariantId: args.digitalVariantId } : {}),
      ...(args.printVariantId ? { printVariantId: args.printVariantId } : {}),
      ...(args.originalVariantId ? { originalVariantId: args.originalVariantId } : {}),
    },
    select: { id: true },
  });

  return { inCart: Boolean(item) };
}

export async function getCart(
  site: Storefront,
  owner: Owner
): Promise<CartSelectedItem[]> {
//   assertOwner(owner);
    if (!owner.userId && !owner.guestId)  return [] ;


  const cartId = await getCartId(site, owner);
  if (!cartId) return [];

  const items = await prisma.cartItem.findMany({
    where: { cartId },
    select: {
      id: true,
      productId: true,
      price: true,
      originalPrice: true,
      quantity: true,
      printVariant: true,
      digitalVariant: true,
      originalVariant: true,
      product: {
        select: {
          ...productListSelect,
          salePrice: true,
          salePercent: true,
          saleStartsAt: true,
          saleEndsAt: true,
        },
      },
      designId: true,
      previewUrlSnapshot: true,
      styleSnapshot: true,
      design: { select: { previewUrl: true, previewUpdatedAt: true } },
    },
  });

  return items.map((ci) => {
    const linkedDesignUrl = ci.design?.previewUrl
      ? ci.design.previewUpdatedAt
        ? `${ci.design.previewUrl}?v=${ci.design.previewUpdatedAt.getTime()}`
        : ci.design.previewUrl
      : null;

    const previewUrl =
      linkedDesignUrl ??
      ci.previewUrlSnapshot ??
      ci.product.thumbnails?.[0] ??
      null;

    return {
      cartItemId: ci.id,
      cartPrice: ci.price,
      cartQuantity: ci.quantity,
      digital: ci.digitalVariant,
      print: ci.printVariant,
      original: ci.originalVariant,
      ...ci.product,
      price: ci.price,
      originalPrice: ci.originalPrice ?? ci.price,
      previewUrl,
      isUserDesign: Boolean(ci.designId),
      saleStartsAt: ci.product.saleStartsAt,
      saleEndsAt: ci.product.saleEndsAt,
      salePercent: ci.product.salePercent,
      salePrice: ci.product.salePrice,
    } as any;
  });
}

/**
 * ✅ POST contract:
 * returns { message, result: { cartItemId, cartId, productId, digitalVariantId, printVariantId, originalVariantId, price, originalPrice, quantity, ... } }
 */
export async function addToCart(
  site: Storefront,
  owner: Owner,
  body: AddToCartBody & { originalType?: boolean }
) {
  assertOwner(owner);

  const productId = String((body as any).productId ?? "");
  if (!productId) throw new Error("Missing productId.");

  const wantDigital = Boolean((body as any).digitalType);
  const wantPrint = Boolean((body as any).printType);
  const wantOriginal = Boolean((body as any).originalType);

  if (!wantDigital && !wantPrint && !wantOriginal) {
    throw new Error("Missing required fields.");
  }

  assertStorefrontAllows(site, { digital: wantDigital, print: wantPrint, original: wantOriginal });

  const quantity = Math.max(1, Number((body as any).quantity ?? 1));
  const cartId = await getOrCreateCartId(site, owner);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      kind: true,
      price: true,
      salePrice: true,
      salePercent: true,
      saleStartsAt: true,
      saleEndsAt: true,
      sizes: true,
      formats: true,
    },
  });
  if (!product) throw new Error("Product not found.");

  // newest design snapshot
  let designId: string | null = null;
  let previewUrlSnapshot: string | null = null;
  let styleSnapshot: any = null;

  const newest = await prisma.userDesign.findFirst({
    where: {
      productId,
      ...(owner.userId ? { userId: owner.userId } : { guestId: owner.guestId! }),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, previewUrl: true, style: true },
  });

  if (newest) {
    designId = newest.id;
    previewUrlSnapshot = newest.previewUrl ?? null;
    styleSnapshot = newest.style ?? null;
  }

  // ---------------- JEANYVES (ORIGINAL-only) ----------------
  if (site === "JEANYVES") {
    const originalVariant = await prisma.productVariant.findFirst({
      where: {
        productId,
        type: VariantType.ORIGINAL,
        status: InventoryStatus.ACTIVE,
        soldAt: null,
      },
      select: { id: true, listPrice: true },
    });
    if (!originalVariant) throw new Error("No ACTIVE ORIGINAL variant available for this product.");

    const baseUnit = roundMoney(originalVariant.listPrice ?? product.price);
    const sale = getEffectiveSale({
      price: baseUnit,
      salePrice: product.salePrice,
      salePercent: product.salePercent,
      saleStartsAt: product.saleStartsAt,
      saleEndsAt: product.saleEndsAt,
    });
    const finalUnitPrice = roundMoney(sale.price);

    const existing = await prisma.cartItem.findFirst({
      where: { cartId, productId, originalVariantId: originalVariant.id },
      select: { id: true, quantity: true },
    });

    if (!existing) {
      const created = await prisma.cartItem.create({
        data: {
          cartId,
          productId,
          originalVariantId: originalVariant.id,
          digitalVariantId: null,
          printVariantId: null,
          price: finalUnitPrice,
          originalPrice: baseUnit,
          quantity,
          designId,
          previewUrlSnapshot,
          styleSnapshot,
        },
        select: { id: true },
      });

      return {
        message: "Item added.",
        result: {
          cartItemId: created.id,
          cartId,
          productId,
          digitalVariantId: null,
          printVariantId: null,
          originalVariantId: originalVariant.id,
          price: finalUnitPrice,
          originalPrice: baseUnit,
          quantity,
          designId,
          previewUrlSnapshot,
          styleSnapshot: Boolean(styleSnapshot),
        },
      };
    }

    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + quantity,
        price: finalUnitPrice,
        originalPrice: baseUnit,
        designId,
        previewUrlSnapshot,
        styleSnapshot,
      },
      select: { id: true, quantity: true },
    });

    return {
      message: "Item added (merged).",
      result: {
        cartItemId: updated.id,
        cartId,
        productId,
        digitalVariantId: null,
        printVariantId: null,
        originalVariantId: originalVariant.id,
        price: finalUnitPrice,
        originalPrice: baseUnit,
        quantity: updated.quantity,
        designId,
        previewUrlSnapshot,
        styleSnapshot: Boolean(styleSnapshot),
      },
    };
  }

  // ---------------- ZILEDIGITAL (DIGITAL/PRINT) ----------------
  const license = String((body as any).license ?? "personal");
  const format = String((body as any).format ?? "png").toLowerCase();
  const size = (body as any).size ?? allSizes[0].label ?? null;
  const material = (body as any).material ?? null;
  const frame = (body as any).frame ?? null;

  const orphanCandidates: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    let line = await tx.cartItem.findFirst({
      where: { cartId, productId },
      orderBy: { addedAt: "desc" },
      select: { id: true, digitalVariantId: true, printVariantId: true },
    });

    if (!line) {
      line = await tx.cartItem.create({
        data: {
          cartId,
          productId,
          digitalVariantId: null,
          printVariantId: null,
          originalVariantId: null,
          price: 0,
          originalPrice: 0,
          quantity,
          designId,
          previewUrlSnapshot,
          styleSnapshot,
        },
        select: { id: true, digitalVariantId: true, printVariantId: true },
      });
    }

    let digitalVariantId = line.digitalVariantId ?? null;
    let printVariantId = line.printVariantId ?? null;

    // Detach types not wanted (POST “sets” selection)
    if (!wantDigital && digitalVariantId) {
      orphanCandidates.push(digitalVariantId);
      digitalVariantId = null;
      await tx.cartItem.update({ where: { id: line.id }, data: { digitalVariantId: null } });
    }
    if (!wantPrint && printVariantId) {
      orphanCandidates.push(printVariantId);
      printVariantId = null;
      await tx.cartItem.update({ where: { id: line.id }, data: { printVariantId: null } });
    }

    // DIGITAL (update-in-place or create+attach CAS)
    if (wantDigital) {
      if (digitalVariantId) {
        await markVariantCartOrigin(tx, digitalVariantId);
        await tx.productVariant.updateMany({
          where: { id: digitalVariantId, productId, type: VariantType.DIGITAL },
          data: { format, license },
        });
      } else {
        const attachedId = await createAndAttachDigitalCAS({
          tx,
          cartItemId: line.id,
          productId,
          format,
          license,
        });

        // If attach failed because another request attached first, re-read the cart item id
        if (!attachedId) {
          const reread = await tx.cartItem.findUnique({
            where: { id: line.id },
            select: { digitalVariantId: true },
          });
          digitalVariantId = reread?.digitalVariantId ?? null;
        } else {
          digitalVariantId = attachedId;
        }
      }
    }

    // PRINT (update-in-place or create+attach CAS)
    if (wantPrint) {
      if (printVariantId) {
        await markVariantCartOrigin(tx, printVariantId);
        await tx.productVariant.updateMany({
          where: { id: printVariantId, productId, type: VariantType.PRINT },
          data: { format, size, material, frame },
        });
      } else {
        const attachedId = await createAndAttachPrintCAS({
          tx,
          cartItemId: line.id,
          productId,
          format,
          size,
          material,
          frame,
        });

        if (!attachedId) {
          const reread = await tx.cartItem.findUnique({
            where: { id: line.id },
            select: { printVariantId: true },
          });
          printVariantId = reread?.printVariantId ?? null;
        } else {
          printVariantId = attachedId;
        }
      }
    }

    // fetch variants for pricing
    const dv = digitalVariantId
      ? await tx.productVariant.findUnique({
          where: { id: digitalVariantId },
          select: { id: true, type: true, format: true, license: true },
        })
      : null;

    const pv = printVariantId
      ? await tx.productVariant.findUnique({
          where: { id: printVariantId },
          select: { id: true, type: true, format: true, size: true, material: true, frame: true },
        })
      : null;

    const baseUnit = computeBaseUnit({
      productBase: product.price,
      format: (dv?.format ?? pv?.format ?? format) as any,
      size: pv?.size ?? null,
      material: pv?.material ?? null,
      frame: pv?.frame ?? null,
      license: dv?.license ?? undefined,
      digital: dv as any,
      print: pv as any,
      sizeList: product.sizes,
    });

    const sale = getEffectiveSale({
      price: baseUnit,
      salePrice: product.salePrice,
      salePercent: product.salePercent,
      saleStartsAt: product.saleStartsAt,
      saleEndsAt: product.saleEndsAt,
    });

    const priceWithBundle = applyBundleIfBoth(baseUnit, dv as any, pv as any);
    const finalUnitPrice = roundMoney(Math.min(sale.price, priceWithBundle));

    const updated = await tx.cartItem.update({
      where: { id: line.id },
      data: {
        digitalVariantId,
        printVariantId,
        originalVariantId: null,
        price: finalUnitPrice,
        originalPrice: baseUnit,
        quantity, // POST sets quantity
        ...(designId ? { designId, previewUrlSnapshot, styleSnapshot } : {}),
      },
      select: {
        id: true,
        price: true,
        originalPrice: true,
        quantity: true,
        digitalVariantId: true,
        printVariantId: true,
      },
    });

    // Should never happen because POST requires at least one variant,
    // but keep it safe:
    if (!updated.digitalVariantId && !updated.printVariantId) {
      await tx.cartItem.delete({ where: { id: updated.id } });
      return {
        deleted: true as const,
        cartItemId: updated.id,
        cartId,
        productId,
      };
    }

    return {
      deleted: false as const,
      cartItemId: updated.id,
      cartId,
      productId,
      digitalVariantId: updated.digitalVariantId,
      printVariantId: updated.printVariantId,
      originalVariantId: null,
      price: updated.price,
      originalPrice: updated.originalPrice,
      quantity: updated.quantity,
      designId,
      previewUrlSnapshot,
      styleSnapshot: Boolean(styleSnapshot),
    };
  });

  // cleanup detached variants (after tx)
  for (const id of uniq(orphanCandidates)) {
    await cleanupCartVariantIfOrphan(id);
  }

  if (result.deleted) {
    return { message: "Cart item removed.", result };
  }

  return { message: "Item added (set).", result };
}

/**
 * ✅ PATCH contract:
 * payload: { productId, digitalVariantId, printVariantId, updates }
 * returns: { message, digitalVariantId, printVariantId, price, originalPrice }
 */
export async function patchCart(
  site: Storefront,
  owner: Owner,
  payload: {
    productId: string;
    digitalVariantId?: "ADD" | "REMOVE" | string | null;
    printVariantId?: "ADD" | "REMOVE" | string | null;
    updates?: any;
  }
) {
  assertOwner(owner);

  if (site === "JEANYVES") {
    throw new Error("PATCH is not supported for JEANYVES cart (ORIGINAL-only).");
  }

  const productId = String(payload.productId ?? "");
  if (!productId) throw new Error("Missing productId.");

  const updates = payload.updates ?? {};
  const fmt = updates.format ? String(updates.format).toLowerCase() : undefined;

  const cartId = await getCartId(site, owner);
  if (!cartId) {
    return { message: "Cart not found.", digitalVariantId: null, printVariantId: null, price: 0, originalPrice: 0 };
  }

  const line = await findCartItemForProduct(cartId, productId);
  if (!line) {
    return { message: "Product not found in cart.", digitalVariantId: null, printVariantId: null, price: 0, originalPrice: 0 };
  }

  const orphanCandidates: string[] = [];

  await prisma.$transaction(async (tx) => {
    const cartItem = await tx.cartItem.findUnique({
      where: { id: line.id },
      select: { id: true, productId: true, digitalVariantId: true, printVariantId: true },
    });
    if (!cartItem) return;

    // ---- DIGITAL ----
    if (payload.digitalVariantId === "REMOVE") {
      if (cartItem.digitalVariantId) orphanCandidates.push(cartItem.digitalVariantId);
      await tx.cartItem.update({ where: { id: cartItem.id }, data: { digitalVariantId: null } });
      cartItem.digitalVariantId = null;
    } else if (payload.digitalVariantId === "ADD") {
      if (cartItem.digitalVariantId) {
        await markVariantCartOrigin(tx, cartItem.digitalVariantId);
        await tx.productVariant.updateMany({
          where: { id: cartItem.digitalVariantId, productId: cartItem.productId, type: VariantType.DIGITAL },
          data: {
            format: fmt ?? undefined,
            license: updates.license ?? undefined,
          },
        });
      } else {
        const attachedId = await createAndAttachDigitalCAS({
          tx,
          cartItemId: cartItem.id,
          productId: cartItem.productId,
          format: fmt ?? null,
          license: updates.license ?? null,
        });

        if (!attachedId) {
          const reread = await tx.cartItem.findUnique({
            where: { id: cartItem.id },
            select: { digitalVariantId: true },
          });
          cartItem.digitalVariantId = reread?.digitalVariantId ?? null;
        } else {
          cartItem.digitalVariantId = attachedId;
        }
      }
    } else if (typeof payload.digitalVariantId === "string") {
      if (cartItem.digitalVariantId && cartItem.digitalVariantId !== payload.digitalVariantId) {
        orphanCandidates.push(cartItem.digitalVariantId);
      }

      await markVariantCartOrigin(tx, payload.digitalVariantId);
      await tx.productVariant.updateMany({
        where: { id: payload.digitalVariantId, productId: cartItem.productId, type: VariantType.DIGITAL },
        data: { format: fmt ?? undefined, license: updates.license ?? undefined },
      });

      await tx.cartItem.update({
        where: { id: cartItem.id },
        data: { digitalVariantId: payload.digitalVariantId },
      });
      cartItem.digitalVariantId = payload.digitalVariantId;
    }

    // ---- PRINT ----
    if (payload.printVariantId === "REMOVE") {
      if (cartItem.printVariantId) orphanCandidates.push(cartItem.printVariantId);
      await tx.cartItem.update({ where: { id: cartItem.id }, data: { printVariantId: null } });
      cartItem.printVariantId = null;
    } else if (payload.printVariantId === "ADD") {
      if (cartItem.printVariantId) {
        await markVariantCartOrigin(tx, cartItem.printVariantId);
        await tx.productVariant.updateMany({
          where: { id: cartItem.printVariantId, productId: cartItem.productId, type: VariantType.PRINT },
          data: {
            format: fmt ?? undefined,
            size: updates.size ?? allSizes[0].label ?? undefined,
            material: updates.material ?? undefined,
            frame: updates.frame ?? undefined,
          },
        });
      } else {
        const attachedId = await createAndAttachPrintCAS({
          tx,
          cartItemId: cartItem.id,
          productId: cartItem.productId,
          format: fmt ?? null,
          size: updates.size ?? allSizes[0].label ?? null,
          material: updates.material ?? null,
          frame: updates.frame ?? null,
        });

        if (!attachedId) {
          const reread = await tx.cartItem.findUnique({
            where: { id: cartItem.id },
            select: { printVariantId: true },
          });
          cartItem.printVariantId = reread?.printVariantId ?? null;
        } else {
          cartItem.printVariantId = attachedId;
        }
      }
    } else if (typeof payload.printVariantId === "string") {
      if (cartItem.printVariantId && cartItem.printVariantId !== payload.printVariantId) {
        orphanCandidates.push(cartItem.printVariantId);
      }

      await markVariantCartOrigin(tx, payload.printVariantId);
      await tx.productVariant.updateMany({
        where: { id: payload.printVariantId, productId: cartItem.productId, type: VariantType.PRINT },
        data: {
          format: fmt ?? undefined,
          size: updates.size ?? allSizes[0].label ?? undefined,
          material: updates.material ?? undefined,
          frame: updates.frame ?? undefined,
        },
      });

      await tx.cartItem.update({
        where: { id: cartItem.id },
        data: { printVariantId: payload.printVariantId },
      });
      cartItem.printVariantId = payload.printVariantId;
    }

    // ✅ if both removed => delete cart line for this user
    if (!cartItem.digitalVariantId && !cartItem.printVariantId) {
      await tx.cartItem.delete({ where: { id: cartItem.id } });
      return;
    }

    // recompute price using fresh data
    const fresh = await tx.cartItem.findUnique({
      where: { id: cartItem.id },
      include: {
        digitalVariant: true,
        printVariant: true,
        product: {
          select: {
            price: true,
            salePrice: true,
            salePercent: true,
            saleStartsAt: true,
            saleEndsAt: true,
            sizes: true,
          },
        },
      },
    });

    if (!fresh?.product) throw new Error("Product not found.");

    const resolvedFormat =
      fmt ??
      fresh.digitalVariant?.format ??
      fresh.printVariant?.format ??
      undefined;

    const resolvedSize = updates.size ?? fresh.printVariant?.size ?? undefined;
    const resolvedMaterial = updates.material ?? fresh.printVariant?.material ?? undefined;
    const resolvedFrame = updates.frame ?? fresh.printVariant?.frame ?? undefined;
    const resolvedLicense = updates.license ?? fresh.digitalVariant?.license ?? undefined;

    const baseUnit = computeBaseUnit({
      productBase: fresh.product.price,
      format: resolvedFormat,
      size: resolvedSize,
      material: resolvedMaterial,
      frame: resolvedFrame,
      license: resolvedLicense,
      digital: fresh.digitalVariant,
      print: fresh.printVariant,
      sizeList: fresh.product.sizes,
    });

    const sale = getEffectiveSale({
      price: baseUnit,
      salePrice: fresh.product.salePrice,
      salePercent: fresh.product.salePercent,
      saleStartsAt: fresh.product.saleStartsAt,
      saleEndsAt: fresh.product.saleEndsAt,
    });

    const priceWithBundle = applyBundleIfBoth(baseUnit, fresh.digitalVariant, fresh.printVariant);
    const finalUnitPrice = roundMoney(Math.min(sale.price, priceWithBundle));

    await tx.cartItem.update({
      where: { id: cartItem.id },
      data: { price: finalUnitPrice, originalPrice: baseUnit },
    });
  });

  // cleanup detached variants (after tx)
  for (const id of uniq(orphanCandidates)) {
    await cleanupCartVariantIfOrphan(id);
  }

  // If cart item was deleted, reflect that
  const stillThere = await prisma.cartItem.findUnique({
    where: { id: line.id },
    select: { id: true },
  });

  if (!stillThere) {
    return {
      message: "Cart item removed because both variants were removed.",
      digitalVariantId: null,
      printVariantId: null,
      price: 0,
      originalPrice: 0,
    };
  }

  const final = await prisma.cartItem.findUnique({
    where: { id: line.id },
    select: { digitalVariantId: true, printVariantId: true, price: true, originalPrice: true },
  });

  return {
    message: "Cart item updated.",
    digitalVariantId: final?.digitalVariantId ?? null,
    printVariantId: final?.printVariantId ?? null,
    price: final?.price ?? 0,
    originalPrice: final?.originalPrice ?? 0,
  };
}

/**
 * ✅ DELETE contract: returns { message }
 * - Also GC the variants that were attached to the removed cart line(s).
 */
export async function deleteFromCart(
  site: Storefront,
  owner: Owner,
  productId: string
) {
  assertOwner(owner);

  const cartId = await getCartId(site, owner);
  if (!cartId) return { message: "Cart not found." };

  const existing = await prisma.cartItem.findMany({
    where: { cartId, productId: String(productId) },
    select: { digitalVariantId: true, printVariantId: true, originalVariantId: true },
  });

  const removed = await prisma.cartItem.deleteMany({
    where: { cartId, productId: String(productId) },
  });

  const ids = uniq(
    existing.flatMap((x) => [x.digitalVariantId, x.printVariantId, x.originalVariantId])
  );

  for (const id of ids) {
    await cleanupCartVariantIfOrphan(id);
  }

  return { message: `Removed ${removed.count} item(s).` };
}


export async function deleteCartItemsByIds(
  site: Storefront,
  owner: Owner,
  cartItemIds: string[]
) {
  assertOwner(owner);

  const ids = uniq(cartItemIds);
  if (ids.length === 0) return { message: "No cart items to remove." };

  const cartId = await getCartId(site, owner);
  if (!cartId) return { message: "Cart not found." };

  // Only delete items that belong to THIS cartId (prevents deleting other users’ items)
  const existing = await prisma.cartItem.findMany({
    where: { id: { in: ids }, cartId },
    select: {
      id: true,
      digitalVariantId: true,
      printVariantId: true,
      originalVariantId: true,
    },
  });

  if (existing.length === 0) return { message: "No matching cart items found." };

  await prisma.cartItem.deleteMany({
    where: { id: { in: existing.map((x) => x.id) } },
  });

  const variantIds = uniq(
    existing.flatMap((x) => [x.digitalVariantId, x.printVariantId, x.originalVariantId])
  );

  for (const vid of variantIds) {
    await cleanupCartVariantIfOrphan(vid);
  }

  return { message: `Removed ${existing.length} purchased cart item(s).` };
}
