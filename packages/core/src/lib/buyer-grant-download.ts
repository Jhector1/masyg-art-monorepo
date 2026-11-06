import { prisma } from "@acme/core/lib/prisma";
import { validateTenantId } from "./tenancy";

/** A 404 is used for all cross-buyer, cross-store and unavailable file lookups. */
export class BuyerGrantError extends Error {
  constructor(public readonly status: 401 | 404 | 409, message = "Not found") {
    super(message);
    this.name = "BuyerGrantError";
  }
}

const validStates = ["PAID", "FULFILLING", "FULFILLED"] as const;
type BuyerGrantIdentity = { userId: string | null | undefined; storeId: string; grantId: string };

function requireBuyer(args: BuyerGrantIdentity) {
  const userId = args.userId?.trim();
  if (!userId) throw new BuyerGrantError(401, "Unauthorized");
  return { userId, storeId: validateTenantId(args.storeId), grantId: validateTenantId(args.grantId) };
}

function usable(grant: {
  revokedAt: Date | null; expiresAt: Date | null;
  uses: number; maximumUses: number | null;
}, now: Date) {
  return grant.revokedAt === null &&
    (grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime()) &&
    Number.isSafeInteger(grant.uses) && grant.uses >= 0 &&
    (grant.maximumUses === null ||
      (Number.isSafeInteger(grant.maximumUses) && grant.maximumUses > grant.uses));
}

/** Read the exact settled order + file snapshot; not the customer's email or a supplied URL. */
export async function authorizeBuyerGrant(args: BuyerGrantIdentity, now = new Date()) {
  const { userId, storeId, grantId } = requireBuyer(args);
  const store = await prisma.storefront.findFirst({
    where: { id: storeId, published: true }, select: { organizationId: true },
  });
  if (!store) throw new BuyerGrantError(404);
  const organizationId = store.organizationId;
  const grant = await prisma.digitalGrant.findFirst({
    where: {
      id: grantId, organizationId,
      item: { order: {
        organizationId, storeId, status: { in: [...validStates] },
        payments: { some: { status: "SUCCEEDED" } },
        customer: { is: { userId } },
      } },
    },
    select: {
      id: true, uses: true, maximumUses: true, expiresAt: true, revokedAt: true,
      digitalFileId: true,
      item: { select: {
        fulfillment: true, variantId: true,
        purchasedFiles: { select: { digitalFileId: true } },
      } },
      file: { select: {
        id: true, variantId: true, label: true,
        asset: { select: { private: true, storageKey: true, mimeType: true } },
      } },
    },
  });
  if (!grant || !usable(grant, now) || grant.item.fulfillment !== "DIGITAL" ||
      grant.file.id !== grant.digitalFileId ||
      grant.file.variantId !== grant.item.variantId ||
      grant.file.asset.private !== true ||
      !grant.item.purchasedFiles.some(file => file.digitalFileId === grant.digitalFileId)) {
    throw new BuyerGrantError(404);
  }
  return {
    grantId, organizationId, storeId, userId, uses: grant.uses, maximumUses: grant.maximumUses,
    label: grant.file.label, mimeType: grant.file.asset.mimeType,
    storageKey: grant.file.asset.storageKey,
  };
}

/** CAS prevents concurrent handoffs from exceeding maximumUses and denies revocation/refund races. */
export async function consumeBuyerGrant(authorized: Awaited<ReturnType<typeof authorizeBuyerGrant>>, now = new Date()) {
  const result = await prisma.digitalGrant.updateMany({
    where: {
      id: authorized.grantId, organizationId: authorized.organizationId,
      uses: authorized.uses, maximumUses: authorized.maximumUses, revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      item: { order: {
        organizationId: authorized.organizationId, storeId: authorized.storeId,
        status: { in: [...validStates] }, payments: { some: { status: "SUCCEEDED" } }, customer: { is: { userId: authorized.userId } },
      } },
    },
    data: { uses: { increment: 1 } },
  });
  if (result.count !== 1) throw new BuyerGrantError(409, "Download eligibility changed; retry");
}
