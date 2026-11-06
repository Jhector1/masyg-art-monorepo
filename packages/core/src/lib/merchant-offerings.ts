import { prisma } from "./prisma";
import { requireMerchantAccess, TenantAccessError, validateTenantId } from "./tenancy";
import { CatalogStateError } from "./catalog-lifecycle";
import { offeringMatchesFulfillment, validateOfferingName, type OfferingKindValue } from "./offering-workflow-policy";

function merchantOfferingName(input: string): string {
  try { return validateOfferingName(input); }
  catch { throw new CatalogStateError("Offering name must be 2–100 characters"); }
}

/** Only metadata is managed here. Variant IDs, fulfillment, price and stock stay authoritative. */
export async function getMerchantOfferings(args: {
  userId: string; organizationId: string; storeId: string; productId: string;
}) {
  const access = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId,
    storeId: args.storeId, capability: "read",
  });
  const productId = validateTenantId(args.productId);
  const listing = await prisma.storeListing.findFirst({
    where: { organizationId: access.organizationId, storeId: access.storeId!, productId },
    select: { productId: true },
  });
  if (!listing) throw new TenantAccessError(404);
  const [offerings, variants] = await Promise.all([
    prisma.productOffering.findMany({
      where: { organizationId: access.organizationId, productId },
      select: { id: true, kind: true, name: true, status: true, slug: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.productVariant.findMany({
      where: { organizationId: access.organizationId, productId },
      select: { id: true, offeringId: true, name: true, active: true, fulfillment: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { offerings, variants };
}

export async function createMerchantOffering(args: {
  userId: string; organizationId: string; productId: string; kind: OfferingKindValue; name: string;
}) {
  const access = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId, capability: "manage",
  });
  const productId = validateTenantId(args.productId);
  const name = merchantOfferingName(args.name);
  // A stable, kind-based slug makes simultaneous duplicate creation fail at DB unique constraint.
  const slug = args.kind.toLowerCase();
  return prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({
      where: { organizationId: access.organizationId, id: productId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!product) throw new TenantAccessError(404);
    const duplicate = await tx.productOffering.findFirst({
      where: { organizationId: access.organizationId, productId, kind: args.kind }, select: { id: true },
    });
    if (duplicate) throw new CatalogStateError("This product already has that offering type. Edit the existing offering instead.");
    const offering = await tx.productOffering.create({ data: {
      organizationId: access.organizationId, productId, kind: args.kind,
      name, slug, status: "DRAFT",
    }});
    await tx.merchantAuditLog.create({ data: {
      organizationId: access.organizationId, actorUserId: args.userId,
      action: "catalog.offering.created", targetType: "ProductOffering", targetId: offering.id,
    }});
    return offering;
  });
}

export async function updateMerchantOffering(args: {
  userId: string; organizationId: string; productId: string; offeringId: string;
  kind: OfferingKindValue; name: string;
}) {
  const access = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId, capability: "manage",
  });
  const productId = validateTenantId(args.productId);
  const offeringId = validateTenantId(args.offeringId);
  const name = merchantOfferingName(args.name);
  return prisma.$transaction(async tx => {
    const offering = await tx.productOffering.findFirst({
      where: { id: offeringId, organizationId: access.organizationId, productId, product: { status: { not: "ARCHIVED" } } },
      select: { id: true, kind: true, variants: { select: { fulfillment: true } } },
    });
    if (!offering) throw new TenantAccessError(404);
    if (offering.variants.some(v => !offeringMatchesFulfillment(args.kind, v.fulfillment)))
      throw new CatalogStateError("This offering contains incompatible editions. Move the editions first.");
    const duplicate = await tx.productOffering.findFirst({
      where: { organizationId: access.organizationId, productId, kind: args.kind, id: { not: offeringId } },
      select: { id: true },
    });
    if (duplicate) throw new CatalogStateError("This product already has that offering type.");
    const updated = await tx.productOffering.update({
      where: { organizationId_productId_id: { organizationId: access.organizationId, productId, id: offeringId } },
      data: { kind: args.kind, name, slug: args.kind.toLowerCase() },
    });
    await tx.merchantAuditLog.create({ data: {
      organizationId: access.organizationId, actorUserId: args.userId,
      action: "catalog.offering.updated", targetType: "ProductOffering", targetId: offeringId,
    }});
    return updated;
  });
}

/** Reassign a variant only to an offering of the SAME PRODUCT and matching fulfillment. */
export async function assignMerchantVariantOffering(args: {
  userId: string; organizationId: string; productId: string; variantId: string; offeringId: string;
}) {
  const access = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId, capability: "manage",
  });
  const productId = validateTenantId(args.productId);
  const variantId = validateTenantId(args.variantId);
  const offeringId = validateTenantId(args.offeringId);
  return prisma.$transaction(async tx => {
    const offering = await tx.productOffering.findFirst({
      where: { id: offeringId, organizationId: access.organizationId, productId, product: { status: { not: "ARCHIVED" } } },
      select: { id: true, kind: true },
    });
    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, organizationId: access.organizationId, productId },
      select: { id: true, fulfillment: true, offeringId: true },
    });
    if (!offering || !variant) throw new TenantAccessError(404);
    if (!offeringMatchesFulfillment(offering.kind, variant.fulfillment))
      throw new CatalogStateError("Digital downloads cannot be assigned to physical offerings, or vice versa.");
    if (variant.offeringId !== offeringId) {
      const update = await tx.productVariant.updateMany({
        where: { id: variantId, productId, organizationId: access.organizationId },
        data: { offeringId },
      });
      if (update.count !== 1) throw new TenantAccessError(404);
      await tx.merchantAuditLog.create({ data: {
        organizationId: access.organizationId, actorUserId: args.userId,
        action: "catalog.variant.offering_assigned", targetType: "ProductVariant", targetId: variantId,
      }});
    }
    return { variantId, offeringId };
  });
}
