/** Server-only, verified merchant workspace selection. Every page uses this boundary. */
import "server-only";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import { listMerchantOrganizations, requireMerchantAccess, validateTenantId } from "@acme/core/lib/tenancy";
import { prisma } from "@acme/core/lib/prisma";
import { notFound, redirect } from "next/navigation";

export type StoreChoice = {
  organizationId: string; organizationName: string; role: "OWNER" | "ADMIN" | "MEMBER";
  storeId: string; storeName: string; published: boolean;
};
export type MerchantSearch = Promise<{ store?: string }>;

export async function merchantWorkspace(searchParams?: MerchantSearch) {
  let userId: string;
  try { userId = await requireMerchantPrincipal(); }
  catch (error) {
    if (error instanceof Error && "status" in error && error.status === 428) redirect("/merchant/security?next=/merchant");
    redirect("/merchant/signin?callbackUrl=/merchant");
  }
  const memberships = await listMerchantOrganizations(userId);
  const stores: StoreChoice[] = memberships.flatMap(m => m.organization.stores.map(s => ({
    organizationId: m.organization.id, organizationName: m.organization.name,
    role: m.role, storeId: s.id, storeName: s.name, published: s.published,
  })));
  const requested = (await searchParams)?.store;
  if (requested && (typeof requested !== "string" || !stores.some(s => s.storeId === requested))) notFound();
  return { userId, stores, store: stores.find(s => s.storeId === requested) ?? stores[0] };
}

/** A direct product URL is never authorized solely by its product ID or query-string store. */
export async function merchantListing(userId: string, store: StoreChoice, productId: string) {
  const scope = await requireMerchantAccess({
    userId, organizationId: store.organizationId, storeId: store.storeId, capability: "read",
  });
  const listing = await prisma.storeListing.findUnique({
    where: { organizationId_storeId_productId: {
      organizationId: scope.organizationId, storeId: scope.storeId!, productId: validateTenantId(productId),
    } },
    select: {
      slug: true, status: true,
      product: { select: {
        id: true, title: true, description: true, status: true, offersDigitalLicenses:true, offersFraming:true, offersGlazing:true,
        categories: { select: { categoryId: true } },
        media: { where: { asset: { private: false } }, orderBy: [{ sortOrder: "asc" }, { assetId: "asc" }],
          select: { sortOrder: true, altText: true, asset: { select: { id: true, mimeType: true } } } },
        variants: { orderBy: { createdAt: "asc" }, select: {
          id: true, name: true, priceMinor: true, compareAtMinor: true, currency: true, active: true,
          sku: true, fulfillment: true, attributes: true,
          digitalFiles: { select: { id: true, label: true, retiredAt: true, asset: { select: { mimeType: true } } } },
        } },
      } },
    },
  });
  if (!listing) notFound();
  return listing;
}
