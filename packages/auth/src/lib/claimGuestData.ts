import { prisma } from "@acme/core/lib/prisma";
export async function claimGuestData({
  guestId,
  userId,
}: {
  guestId: string;
  userId: string;
}) {
  if (!guestId || !userId) return;

  await prisma.$transaction([
    prisma.cart.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    }),

    prisma.favorite.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    }),

    prisma.review.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    }),

    prisma.order.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    }),

    prisma.userDesign.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    }),

    prisma.designEntitlement.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    }),

    prisma.designUsage.updateMany({
      where: { guestId },
      data: { userId, guestId: null },
    }),
  ]);
}
