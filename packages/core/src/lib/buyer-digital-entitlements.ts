import { prisma } from "@acme/core/lib/prisma";
import { validateTenantId } from "./tenancy";

/** A buyer's customer association is established by server-side identity proof,
 * NOT by matching email addresses supplied in a request.
 * Guest orders without a verified Customer.userId cannot be listed here.
 */
export class BuyerDigitalAccessError extends Error {
  constructor(public readonly status: 401 | 404, message = "Not found") {
    super(message);
    this.name = "BuyerDigitalAccessError";
  }
}

type BuyerDigitalFile = {
  grantId: string;
  fileId: string;
  label: string;
};
type BuyerDigitalItem = {
  orderItemId: string;
  title: string;
  files: BuyerDigitalFile[];
};
type BuyerDigitalOrder = {
  orderId: string;
  placedAt: string;
  items: BuyerDigitalItem[];
};

/** Authenticated, read-only entitlement catalog. No download tokens, payment
 * credentials, storage identifiers, or raw Prisma objects are returned.
 * It is deliberately NOT a file serving/download endpoint.
 */
export async function listBuyerDigitalEntitlements(args: {
  userId: string | null | undefined;
  storeId: string;
  now?: Date;
}): Promise<{ orders: BuyerDigitalOrder[] }> {
  const userId = args.userId?.trim();
  if (!userId) {
    throw new BuyerDigitalAccessError(401, "Unauthorized");
  }
  const storeId = validateTenantId(args.storeId);
  const now = args.now ?? new Date();
  const store = await prisma.storefront.findUnique({
    where: { id: storeId }, select: { organizationId: true },
  });
  if (!store) throw new BuyerDigitalAccessError(404);

  // Organization + storefront + signed-in Customer.userId + settled status
  // are enforced by the database, not inferred from buyer email or order IDs.
  const orders = await prisma.order.findMany({
    where: {
      organizationId: store.organizationId,
      storeId,
      status: { in: ["PAID", "FULFILLING", "FULFILLED"] },
      customer: { is: { userId } },
    },
    select: {
      id: true, createdAt: true,
      items: {
        where: { fulfillment: "DIGITAL" },
        select: {
          id: true, variantId: true, titleSnapshot: true, fulfillment: true,
          purchasedFiles: { select: { digitalFileId: true } },
          grants: {
            where: { revokedAt: null },
            select: {
              id: true, digitalFileId: true,
              expiresAt: true, maximumUses: true, uses: true, revokedAt: true,
              file: {
                select: {
                  id: true, label: true, variantId: true,
                  asset: { select: { private: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
  });

  const accessible: BuyerDigitalOrder[] = [];
  for (const order of orders) {
    const items: BuyerDigitalItem[] = [];
    for (const item of order.items) {
      if (item.fulfillment !== "DIGITAL") continue;
      const purchased = new Set(item.purchasedFiles.map((f) => f.digitalFileId));
      const seen = new Set<string>();
      const files: BuyerDigitalFile[] = [];
      for (const grant of item.grants) {
        // Defense in depth: refuse entitlements whose file changed ownership,
        // became public, was unsnapshotted, or is no longer usable.
        if (
          grant.revokedAt !== null ||
          !grant.id || !grant.digitalFileId ||
          !purchased.has(grant.digitalFileId) ||
          seen.has(grant.digitalFileId) ||
          grant.file?.id !== grant.digitalFileId ||
          grant.file.variantId !== item.variantId ||
          grant.file.asset?.private !== true ||
          !Number.isSafeInteger(grant.uses) || grant.uses < 0 ||
          (grant.maximumUses !== null &&
            (!Number.isSafeInteger(grant.maximumUses) || grant.maximumUses <= grant.uses)) ||
          (grant.expiresAt !== null &&
            (!(grant.expiresAt instanceof Date) ||
              !Number.isFinite(grant.expiresAt.getTime()) ||
              grant.expiresAt.getTime() <= now.getTime()))
        ) continue;
        seen.add(grant.digitalFileId);
        files.push({
          grantId: grant.id,
          fileId: grant.digitalFileId,
          label: grant.file.label,
        });
      }
      if (files.length) items.push({ orderItemId: item.id, title: item.titleSnapshot, files });
    }
    if (items.length) accessible.push({
      orderId: order.id,
      placedAt: order.createdAt.toISOString(),
      items,
    });
  }
  return { orders: accessible };
}
