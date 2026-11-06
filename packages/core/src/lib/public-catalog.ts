import { prisma } from "@acme/core/lib/prisma";
import type { Prisma } from "@prisma/client";
import { physicalOptionsAllowed } from "./physical-options";

/** Public reads never use merchant credentials and never return secret storage keys. */
export class PublicCatalogError extends Error {
  constructor(public readonly status: 400 | 404, message = "Not found") {
    super(message);
    this.name = "PublicCatalogError";
  }
}

const storeIdPattern = /^[a-zA-Z0-9_-]{3,128}$/;
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function requirePublicStoreId(input: unknown): string {
  if (typeof input !== "string" || !storeIdPattern.test(input)) {
    throw new PublicCatalogError(404);
  }
  return input;
}

export function requirePublicProductSlug(input: unknown): string {
  if (typeof input !== "string" || !slugPattern.test(input)) {
    throw new PublicCatalogError(404);
  }
  return input;
}

/** Strict hostname used only with verified domain records, never forwarded headers. */
export function normalizeVerifiedHostname(input: unknown): string {
  if (typeof input !== "string" || input.length > 253) throw new PublicCatalogError(404);
  const hostname = input.toLowerCase().replace(/\.$/, "");
  if (!hostname.includes(".") || hostname.includes(":") || hostname.includes("/") ||
      !hostname.split(".").every((part) =>
        part.length >= 1 && part.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part))) {
    throw new PublicCatalogError(404);
  }
  return hostname;
}

export function parsePublicListingPage(input: { limit?: number; page?: number }) {
  const limit = input.limit ?? 24;
  const page = input.page ?? 1;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      !Number.isSafeInteger(page) || page < 1 || page > 1000) {
    throw new PublicCatalogError(400, "Invalid pagination");
  }
  return { take: limit, skip: (page - 1) * limit, page };
}

const publicStoreSelect = {
  id: true, organizationId: true, slug: true, name: true,
} satisfies Prisma.StorefrontSelect;

// Only public preview asset identifiers. NEVER expose storageKey, secretRef,
// digital download file IDs or token hashes through the storefront catalog.
const publicListingSelect = {
  slug: true,
  product: {
    select: {
      id: true, title: true, description: true, offersDigitalLicenses:true, offersFraming:true, offersGlazing:true,
      categories:{select:{category:{select:{slug:true}}}},
      media: {
        where: { asset: { private: false } },
        select: {
          sortOrder: true, altText: true,
          asset: { select: { id: true, mimeType: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      variants: {
        where: { active: true },
        select: {
          id: true, name: true, attributes: true, fulfillment: true,
          inventoryPolicy: true, priceMinor: true, compareAtMinor: true, currency: true,
          // The canonical offering relation identifies a print; never infer PRINT
          // from a generic physical item's size or label.
          offering: { select: { kind: true } },
          inventory: { select: { onHand: true, reserved: true } },
          digitalFiles: {
            where: { retiredAt: null, asset: { private: true } },
            select: { id: true },
          },
        },
      },
    },
  },
} satisfies Prisma.StoreListingSelect;

type PublicListingRow = Prisma.StoreListingGetPayload<{ select: typeof publicListingSelect }>;

function serializePublicListing(listing: PublicListingRow) {
  return {
    slug: listing.slug,
    product: {
      id: listing.product.id,
      title: listing.product.title,
      description: listing.product.description,
      offersDigitalLicenses:listing.product.offersDigitalLicenses,
      offersFraming:listing.product.offersFraming, offersGlazing:listing.product.offersGlazing,
      categories: listing.product.categories?.map(row=>row.category.slug) ?? [],
      // The media API must authorize preview access by this public asset ID.
      publicMedia: listing.product.media.map(({ asset, altText }) => ({
        assetId: asset.id, mimeType: asset.mimeType, altText: altText || null,
      })),
      variants: listing.product.variants.filter((variant) => {
        if (!physicalOptionsAllowed(listing.product,variant.fulfillment,variant.attributes)) return false;
        if (variant.fulfillment !== "DIGITAL") return true;
        const attrs=variant.attributes;
        const license=attrs&&typeof attrs==="object"&&!Array.isArray(attrs)?(attrs as Record<string,unknown>).license:null;
        const isLicensed=license==="personal"||license==="commercial"||license==="extended";
        // Selector opt-in governs CHOICE display. Fixed licensed digital editions
        // stay available if active and backed by a private file. Malformed tiers
        // are never offered; multi-choice mode requires explicit valid tiers.
        return listing.product.offersDigitalLicenses ? isLicensed : (!license || isLicensed);
      }).map((variant) => {
        const availableStock = variant.inventory.reduce((quantity, level) =>
          quantity + Math.max(0, level.onHand - level.reserved), 0);
        const available = variant.fulfillment === "DIGITAL"
          ? variant.digitalFiles.length > 0
          : variant.inventoryPolicy === "UNLIMITED" || availableStock > 0;
        return {
          id: variant.id,
          name: variant.name,
          attributes: variant.attributes,
          // Public classification only; never expose organization IDs, SKU,
          // unpublished offering details, private assets or stock quantities.
          offeringKind: variant.offering?.kind ?? null,
          fulfillment: variant.fulfillment,
          priceMinor: variant.priceMinor,
          compareAtMinor: variant.compareAtMinor,
          currency: variant.currency,
          available,
        };
      }),
    },
  };
}

export async function resolvePublishedStore(storeId: string) {
  const store = await prisma.storefront.findFirst({
    where: { id: requirePublicStoreId(storeId), published: true },
    select: publicStoreSelect,
  });
  if (!store) throw new PublicCatalogError(404);
  return store;
}

/** Explicit per-app development preview binding; never infer a store from a visitor's input. */
export async function resolvePublishedLocalPreviewStore(args: { organizationId: string; storeId: string }) {
  const store = await prisma.storefront.findFirst({
    where: {
      id: requirePublicStoreId(args.storeId),
      organizationId: requirePublicStoreId(args.organizationId),
      published: true,
    },
    select: publicStoreSelect,
  });
  if (!store) throw new PublicCatalogError(404);
  return store;
}

/** Custom-domain lookup is only permitted after domain ownership verification. */
export async function resolvePublishedStoreByDomain(hostname: string) {
  const domain = await prisma.storeDomain.findUnique({
    where: { hostname: normalizeVerifiedHostname(hostname) },
    select: {
      status: true, verifiedAt: true,
      store: { select: { ...publicStoreSelect, published: true } },
    },
  });
  if (!domain || domain.status !== "VERIFIED" || !domain.verifiedAt || !domain.store.published) {
    throw new PublicCatalogError(404);
  }
  return {
    id: domain.store.id,
    organizationId: domain.store.organizationId,
    slug: domain.store.slug,
    name: domain.store.name,
  };
}

export async function listPublicProducts(args: {
  storeId: string; query?: string; page?: number; limit?: number;
}) {
  const store = await resolvePublishedStore(args.storeId);
  const pagination = parsePublicListingPage(args);
  const query = args.query?.trim();
  if (query && query.length > 120) throw new PublicCatalogError(400, "Search too long");
  const listings = await prisma.storeListing.findMany({
    where: {
      organizationId: store.organizationId,
      storeId: store.id,
      status: "PUBLISHED",
      store: { published: true },
      product: {
        status: "PUBLISHED",
        variants: { some: { active: true } },
        ...(query ? { OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
        ] } : {}),
      },
    },
    select: publicListingSelect,
    orderBy: [{ createdAt: "desc" }, { productId: "asc" }],
    skip: pagination.skip,
    take: pagination.take,
  });
  return {
    store: { id: store.id, slug: store.slug, name: store.name },
    page: pagination.page,
    products: listings.map(serializePublicListing),
  };
}

/** Map a buyer's saved product IDs to the CURRENT published store listings only. */
export async function listPublicProductsByIds(args: {storeId: string; productIds: string[]}) {
  const store = await resolvePublishedStore(args.storeId);
  if (args.productIds.length === 0) return {store:{id:store.id,slug:store.slug,name:store.name},products:[]};
  if (args.productIds.length > 100) throw new PublicCatalogError(400,"Too many saved products");
  const listings = await prisma.storeListing.findMany({
    where: {
      organizationId:store.organizationId,storeId:store.id,
      productId:{in:args.productIds},status:"PUBLISHED",
      store:{published:true},product:{status:"PUBLISHED",variants:{some:{active:true}}},
    },
    select:publicListingSelect,
    orderBy:{createdAt:"desc"},take:100,
  });
  return {store:{id:store.id,slug:store.slug,name:store.name},products:listings.map(serializePublicListing)};
}

export async function getPublicProduct(args: { storeId: string; slug: string }) {
  const store = await resolvePublishedStore(args.storeId);
  const listing = await prisma.storeListing.findFirst({
    where: {
      organizationId: store.organizationId,
      storeId: store.id,
      slug: requirePublicProductSlug(args.slug),
      status: "PUBLISHED",
      store: { published: true },
      product: { status: "PUBLISHED", variants: { some: { active: true } } },
    },
    select: publicListingSelect,
  });
  if (!listing) throw new PublicCatalogError(404);
  return { store: { id: store.id, slug: store.slug, name: store.name }, ...serializePublicListing(listing) };
}
