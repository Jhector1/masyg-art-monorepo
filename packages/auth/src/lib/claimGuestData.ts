import { prisma } from "@acme/db";

export async function claimGuestData({
  guestId,
  userId,
}: {
  guestId: string;
  userId: string;
}) {
  if (!guestId || !userId) return;

  await prisma.$transaction(async (tx) => {
    const guestCarts = await tx.cart.findMany({
      where: { guestId },
      select: { id: true, site: true },
    });

    for (const guestCartRef of guestCarts) {
      const guestCart = await tx.cart.findUnique({
        where: { id: guestCartRef.id },
        include: { items: true },
      });
      if (!guestCart) continue;

      const userCart = await tx.cart.findFirst({
        where: { userId, site: guestCart.site },
        include: { items: true },
      });

      if (!userCart) {
        await tx.cart.update({
          where: { id: guestCart.id },
          data: { userId, guestId: null },
        });
        continue;
      }

      for (const item of guestCart.items) {
        const identity =
          item.originalVariantId
            ? { originalVariantId: item.originalVariantId }
            : item.digitalVariantId
              ? { digitalVariantId: item.digitalVariantId }
              : item.printVariantId
                ? { printVariantId: item.printVariantId }
                : {
                    digitalVariantId: null,
                    printVariantId: null,
                    originalVariantId: null,
                  };

        const existing = await tx.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: item.productId,
            ...identity,
          },
        });

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
          continue;
        }

        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: item.productId,
            digitalVariantId: item.digitalVariantId,
            printVariantId: item.printVariantId,
            originalVariantId: item.originalVariantId,
            price: item.price,
            originalPrice: item.originalPrice,
            quantity: item.quantity,
            designId: item.designId,
            previewUrlSnapshot: item.previewUrlSnapshot,
            styleSnapshot: item.styleSnapshot ?? undefined,
          },
        });
      }

      await tx.cart.delete({ where: { id: guestCart.id } });
    }

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
