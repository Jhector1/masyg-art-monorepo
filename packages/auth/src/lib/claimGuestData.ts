import { prisma } from "@acme/db";
import { hashGuestCartToken } from "./guestIdentity";

/**
 * Claim a single bearer-token cart after successful authentication.
 * No guest purchase rights, orders or reviews are transferred implicitly.
 * The token identifies exactly one cart, whose organization and store are read
 * from the trusted database record, never from request input.
 */
export async function claimGuestData({ guestId, userId }: { guestId: string; userId: string }) {
  if (!guestId || !userId) return;
  const guestTokenHash = hashGuestCartToken(guestId);

  await prisma.$transaction(async (tx) => {
    const guestCart = await tx.cart.findUnique({
      where: { guestTokenHash },
      include: { items: true },
    });
    if (!guestCart) return;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new Error("Authenticated identity not found");

    const organizationId = guestCart.organizationId;
    const storeId = guestCart.storeId;
    let customer = await tx.customer.findFirst({
      where: { organizationId, userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      // An existing guest customer may be attached only if unclaimed.
      const byEmail = await tx.customer.findFirst({
        where: { organizationId, email: user.email.trim().toLowerCase() },
        select: { id: true, userId: true },
      });
      if (byEmail?.userId && byEmail.userId !== user.id) {
        throw new Error("Customer identity is already associated with a different account");
      }
      customer = byEmail
        ? await tx.customer.update({
            where: { id: byEmail.id },
            data: { userId: user.id },
            select: { id: true },
          })
        : await tx.customer.create({
            data: {
              organizationId,
              userId: user.id,
              email: user.email.trim().toLowerCase(),
              name: user.name,
            },
            select: { id: true },
          });
    }

    const existingCart = await tx.cart.findFirst({
      where: {
        organizationId,
        storeId,
        customerId: customer.id,
        id: { not: guestCart.id },
      },
      select: { id: true },
    });

    if (!existingCart) {
      await tx.cart.update({
        where: { id: guestCart.id },
        data: { customerId: customer.id, guestTokenHash: null },
      });
      return;
    }

    // Unique (organization, cart, variant) prevents duplicate lines.
    for (const item of guestCart.items) {
      await tx.cartItem.upsert({
        where: {
          organizationId_cartId_variantId: {
            organizationId,
            cartId: existingCart.id,
            variantId: item.variantId,
          },
        },
        update: { quantity: { increment: item.quantity } },
        create: {
          organizationId,
          cartId: existingCart.id,
          variantId: item.variantId,
          quantity: item.quantity,
        },
      });
    }
    await tx.cart.delete({ where: { id: guestCart.id } });
  });
}
