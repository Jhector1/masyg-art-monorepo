/** Single canonical merchant domain boundary. Never use platform isAdmin to authorize commerce.
 * Identity MUST originate from a server-verified session, never request JSON.
 * All organization and store IDs are checked before every merchant data operation.
 */
import { prisma } from "@acme/core/lib/prisma";
import type { OrganizationRole, StoreRole } from "@prisma/client";
import { catalogCreateInput } from "./catalog-contract";

export type MerchantCapability = "read" | "write" | "manage";

export class TenantAccessError extends Error {
  constructor(public readonly status: 401 | 403 | 404 | 428, message = "Not found") {
    super(message);
    this.name = "TenantAccessError";
  }
}

export function validateTenantId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(value)) {
    throw new TenantAccessError(404);
  }
  return value;
}

export function validateSlug(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)) {
    throw new Error("Invalid slug: use 1–63 lowercase letters, numbers or hyphens");
  }
  return value;
}

function canOrganization(role: OrganizationRole, capability: MerchantCapability): boolean {
  return role === "OWNER" || role === "ADMIN" || (role === "MEMBER" && capability === "read");
}

function canStore(role: StoreRole, capability: MerchantCapability): boolean {
  return role === "MANAGER" || (role === "EDITOR" && capability !== "manage") ||
    (role === "VIEWER" && capability === "read");
}

/** Org OWNER/ADMIN can manage all stores; MEMBER requires store grant.
 * A MEMBER cannot access organization-wide catalog/management even when a store grant exists.
 */
export async function requireMerchantAccess(args: {
  userId: string | null | undefined;
  organizationId: string;
  storeId?: string;
  capability: MerchantCapability;
}): Promise<{ organizationId: string; storeId?: string; role: OrganizationRole }> {
  if (!args.userId) throw new TenantAccessError(401, "Unauthorized");
  const organizationId = validateTenantId(args.organizationId);
  const storeId = args.storeId === undefined ? undefined : validateTenantId(args.storeId);
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: args.userId } },
    select: { role: true },
  });
  if (!membership) throw new TenantAccessError(404);

  if (!storeId) {
    if (!canOrganization(membership.role, args.capability)) throw new TenantAccessError(404);
    return { organizationId, role: membership.role };
  }

  const store = await prisma.storefront.findFirst({
    where: { id: storeId, organizationId }, select: { id: true },
  });
  if (!store) throw new TenantAccessError(404);

  if (membership.role === "MEMBER") {
    const grant = await prisma.storeMember.findUnique({
      where: { organizationId_storeId_userId: { organizationId, storeId, userId: args.userId } },
      select: { role: true },
    });
    if (!grant || !canStore(grant.role, args.capability)) throw new TenantAccessError(404);
  }
  return { organizationId, storeId, role: membership.role };
}

/** Store catalog ONLY via StoreListing. A product need not be published on all stores. */
export async function listMerchantProducts(args: {
  userId: string | null | undefined;
  organizationId: string;
  storeId: string;
  query?: string;
}) {
  const scope = await requireMerchantAccess({ ...args, capability: "read" });
  const q = args.query?.trim().slice(0, 120);
  return prisma.storeListing.findMany({
    where: {
      organizationId: scope.organizationId, storeId: scope.storeId!,
      ...(q ? { product: { OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
      ] } } : {}),
    },
    select: {
      slug: true, status: true, product: {
        select: { id: true, title: true, description: true, status: true,
        media: { where: { asset: { private: false } }, orderBy: { sortOrder: "asc" }, select: { altText: true, asset: { select: { id: true, mimeType: true } } } },
        variants: {
          select: { id: true, name: true, fulfillment: true, priceMinor: true, compareAtMinor: true, currency: true, active: true, attributes: true,
          digitalFiles: { select: { id: true, label: true, asset: { select: { mimeType: true } } } } },
        } },
      },
    },
    take: 50, orderBy: { updatedAt: "desc" },
  });
}

export async function findMerchantProduct(args: {
  userId: string | null | undefined;
  organizationId: string;
  storeId: string;
  productId: string;
}) {
  const scope = await requireMerchantAccess({ ...args, capability: "read" });
  return prisma.storeListing.findUnique({
    where: { organizationId_storeId_productId: {
      organizationId: scope.organizationId, storeId: scope.storeId!,
      productId: validateTenantId(args.productId),
    } },
    include: { product: { include: { variants: true } } },
  });
}

export async function provisionMerchantStore(args: {
  verifiedUserId: string;
  organizationName: string;
  organizationSlug: string;
  storeName: string;
  storeSlug: string;
}) {
  if (!args.verifiedUserId) throw new TenantAccessError(401, "Unauthorized");
  const organizationName = args.organizationName.trim();
  const storeName = args.storeName.trim();
  if (!organizationName || organizationName.length > 120 || !storeName || storeName.length > 120) {
    throw new Error("Invalid organization/store name");
  }
  const organizationSlug = validateSlug(args.organizationSlug);
  const storeSlug = validateSlug(args.storeSlug);
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: {
      name: organizationName, slug: organizationSlug,
    } });
    // One self-provisioned organization per principal; the unique userId
    // prevents concurrent requests from creating duplicate owner stores.
    await tx.merchantOnboardingClaim.create({ data: {
      userId: args.verifiedUserId, organizationId: organization.id,
    } });
    await tx.organizationMember.create({ data: {
      organizationId: organization.id, userId: args.verifiedUserId, role: "OWNER",
    } });
    const store = await tx.storefront.create({ data: {
      organizationId: organization.id, slug: storeSlug, name: storeName,
    } });
    return { organization, store };
  });
}

export async function createMerchantStore(args: {
  verifiedUserId: string;
  organizationId: string;
  name: string;
  slug: string;
}) {
  const scope = await requireMerchantAccess({
    userId: args.verifiedUserId, organizationId: args.organizationId, capability: "manage",
  });
  const name = args.name.trim();
  if (!name || name.length > 120) throw new Error("Invalid store name");
  return prisma.storefront.create({ data: {
    organizationId: scope.organizationId, name, slug: validateSlug(args.slug),
  } });
}

/** Product + purchasable variants are one atomic catalog operation. */
export async function createMerchantProduct(args: {
  verifiedUserId: string;
  organizationId: string;
  title: string;
  description?: string;
  offersDigitalLicenses?: boolean;
  offersFraming?: boolean;
  offersGlazing?: boolean;
  variants: Array<{
    name: string; sku?: string; fulfillment: "PHYSICAL" | "DIGITAL";
    priceMinor: number; compareAtMinor?: number; currency: string;
    attributes?: { size?: string; material?: string; format?: string; edition?: string; finish?: string; frame?: string; glazing?: string; license?: "personal" | "commercial" | "extended" };
  }>;
  /** Optional same-transaction listing for the selected store. */
  storeId?: string;
  listingSlug?: string;
}) {
  const scope = await requireMerchantAccess({
    userId: args.verifiedUserId, organizationId: args.organizationId, capability: "manage",
  });
  if ((args.storeId === undefined) !== (args.listingSlug === undefined)) {
    throw new Error("Store ID and listing slug must be supplied together");
  }
  if (args.storeId) {
    await requireMerchantAccess({ userId: args.verifiedUserId, organizationId: scope.organizationId,
      storeId: args.storeId, capability: "write" });
  }
  const listingSlug = args.listingSlug === undefined ? undefined : validateSlug(args.listingSlug);
  const input = catalogCreateInput.parse({ title: args.title, description: args.description, offersDigitalLicenses: args.offersDigitalLicenses, offersFraming:args.offersFraming, offersGlazing:args.offersGlazing, variants: args.variants });
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: {
      organizationId: scope.organizationId, title: input.title, description: input.description ?? "", offersDigitalLicenses: input.offersDigitalLicenses, offersFraming:input.offersFraming, offersGlazing:input.offersGlazing,
    } });
    await tx.productVariant.createMany({ data: input.variants.map(v => ({
      organizationId: scope.organizationId, productId: product.id,
      name: v.name.trim(), sku: v.sku?.trim(), fulfillment: v.fulfillment,
      inventoryPolicy: v.fulfillment === "PHYSICAL" ? "TRACKED" : "UNLIMITED",
      priceMinor: v.priceMinor, compareAtMinor: v.compareAtMinor, currency: v.currency, attributes: v.attributes,
    })) });
    if (args.storeId && listingSlug) {
      await tx.storeListing.create({ data: {
        organizationId: scope.organizationId, storeId: args.storeId,
        productId: product.id, slug: listingSlug, status: "DRAFT",
      } });
    }
    await tx.merchantAuditLog.create({ data: {
      organizationId: scope.organizationId, actorUserId: args.verifiedUserId,
      action: "catalog.product.created", targetType: "Product", targetId: product.id,
    } });
    return product;
  });
}

/** A store cannot list another organization's product. The DB composite FK enforces it too. */
export async function listProductInStore(args: {
  verifiedUserId: string; organizationId: string; storeId: string;
  productId: string; slug: string;
}) {
  const scope = await requireMerchantAccess({
    userId: args.verifiedUserId, organizationId: args.organizationId,
    storeId: args.storeId, capability: "write",
  });
  const productId = validateTenantId(args.productId);
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: scope.organizationId }, select: { id: true },
  });
  if (!product) throw new TenantAccessError(404);
  return prisma.storeListing.create({ data: {
    organizationId: scope.organizationId, storeId: scope.storeId!, productId,
    slug: validateSlug(args.slug), status: "DRAFT",
  } });
}

/** Used by both the merchant home and API; avoids duplicate query rules. */
export async function listMerchantOrganizations(verifiedUserId: string) {
  if (!verifiedUserId) throw new TenantAccessError(401, "Unauthorized");
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: verifiedUserId },
    select: { role: true, organization: { select: { id: true, slug: true, name: true } } },
    take: 100, orderBy: { createdAt: "asc" },
  });
  return Promise.all(memberships.map(async (membership) => ({
    role: membership.role,
    organization: {
      ...membership.organization,
      stores: await prisma.storefront.findMany({
        where: {
          organizationId: membership.organization.id,
          ...(membership.role === "MEMBER" ? { members: { some: { userId: verifiedUserId } } } : {}),
        },
        select: { id: true, slug: true, name: true, published: true },
        take: 100, orderBy: { createdAt: "asc" },
      }),
    },
  })));
}

export async function listMerchantStores(args: { userId: string; organizationId: string }) {
  const scope = await requireMerchantAccess({ ...args, capability: "read" });
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: scope.organizationId, userId: args.userId } },
    select: { role: true },
  });
  return prisma.storefront.findMany({
    where: {
      organizationId: scope.organizationId,
      ...(membership?.role === "MEMBER" ? { members: { some: { userId: args.userId } } } : {}),
    },
    select: { id: true, slug: true, name: true, published: true },
    orderBy: { createdAt: "asc" }, take: 100,
  });
}
