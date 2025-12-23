import { prisma } from "@acme/core/lib/prisma";

export async function claimGuestData({
  guestId,
  userId,
}: {
  guestId: string;
  userId: string;
}) {
  if (!guestId || !userId) return;

  await prisma.$transaction(async (tx) => {
    // 1) ---- CARTS: merge safely per site (no updateMany) ----
    const guestCarts = await tx.cart.findMany({
      where: { guestId },
      select: { id: true, site: true },
    });

    for (const gc of guestCarts) {
      const guestCart = await tx.cart.findUnique({
        where: { id: gc.id },
        include: {
          items: true, // <-- change to cartItems if that's your relation name
        },
      });
      if (!guestCart) continue;

      // find user's cart for same site (if exists)
      const userCart = await tx.cart.findFirst({
        where: { userId, site: guestCart.site },
        include: { items: true }, // <-- change to match relation name
      });

      // Case A: user has no cart for this site => just reassign guest cart
      if (!userCart) {
        await tx.cart.update({
          where: { id: guestCart.id },
          data: { userId, guestId: null },
        });
        continue;
      }

      // Case B: both carts exist => merge items, then delete guest cart
      for (const item of guestCart.items) {
        // Decide "identity" of an item inside a cart
        // ORIGINAL items: originalVariantId
        // DIGITAL/PRINT: productVariantId (or whatever you use)
        // Fallback: productId if neither exists
        const isOriginal = !!item.originalVariantId;
        const isVariant = !!item.productVariantId;

        // If your schema has unique constraints on cart items like:
        // @@unique([cartId, originalVariantId]) and @@unique([cartId, productVariantId])
        // you can upsert. If not, we’ll do a find+update/create.
        let existing = null as any;

        if (isOriginal) {
          existing = await tx.cartItem.findFirst({
            where: { cartId: userCart.id, originalVariantId: item.originalVariantId },
          });
        } else if (isVariant) {
          existing = await tx.cartItem.findFirst({
            where: { cartId: userCart.id, productVariantId: item.productVariantId },
          });
        } else if (item.productId) {
          existing = await tx.cartItem.findFirst({
            where: { cartId: userCart.id, productId: item.productId },
          });
        }

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: item.productId,
              productVariantId: item.productVariantId,
              originalVariantId: item.originalVariantId,
              quantity: item.quantity,
              // copy any optional fields you store on cart items:
              // options: item.options ?? undefined,
              // site: item.site ?? undefined,
            },
          });
        }
      }

      // Delete guest cart after merge
      await tx.cart.delete({ where: { id: guestCart.id } });
    }

    // 2) ---- Everything else can stay updateMany ----
    await tx.favorite.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    });

    await tx.review.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    });

    await tx.order.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    });

    await tx.userDesign.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    });

    await tx.designEntitlement.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    });

    await tx.designUsage.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    });
  });
}
