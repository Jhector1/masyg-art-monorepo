import { prisma } from "@acme/core/lib/prisma";
import { productListSelect } from "@acme/core/types";
import {
  normalizeTypes,
  variantProductWhere,
  type TypesParam,
} from "@acme/core/utils/variants";
import type { Storefront } from "@prisma/client";

export async function listFavoritesForUser(opts: {
  userId: string;
  site: Storefront;
  types?: TypesParam;
}) {
  // const normalized = normalizeTypes(opts.types);
  // const productWhere = variantProductWhere(normalized);

  return prisma.product.findMany({
    where: {
      site: opts.site,
      favorites: { some: { userId: opts.userId, site: opts.site } },
    },
    select: {
      ...productListSelect,
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addFavorite(opts: {
  userId: string;
  productId: string;
  site: Storefront;
}) {
  const { userId, productId, site } = opts;

  const product = await prisma.product.findFirst({
    where: { id: productId, site },
    select: { id: true },
  });
  if (!product) throw new Error("Product does not belong to this storefront.");

  await prisma.favorite.upsert({
    where: { userId_productId_site: { userId, productId, site } }, // ✅ matches schema
    update: {},
    create: { userId, productId, site },
  });

  return { ok: true };
}

export async function removeFavorite(opts: {
  userId: string;
  productId: string;
  site: Storefront;
}) {
  const { userId, productId, site } = opts;

  await prisma.favorite.deleteMany({
    where: { userId, productId, site },
  });

  return { ok: true };
}
