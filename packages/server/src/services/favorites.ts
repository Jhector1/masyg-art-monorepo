// packages/server/src/favorites.ts
import { prisma } from "@acme/core/lib/prisma";
import { productListSelect } from "@acme/core/types"; // <-- server-safe select (no React)
import { normalizeTypes, variantProductWhere, type TypesParam } from "@acme/core/utils/variants";

type ListFavoritesInput = { userId: string; types?: TypesParam };

export async function listFavoritesForUser({ userId, types }: ListFavoritesInput) {
  const normalized = normalizeTypes(types);                // e.g. ["DIGITAL","PRINT"] | ["ORIGINAL"] | undefined
  const productWhere = variantProductWhere(normalized);    // server-safe pure function

  const products = await prisma.product.findMany({
    where: {
      ...productWhere,
      favorites: { some: { userId } },
    },
    select: {
      ...productListSelect,
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return products;
}

export async function addFavorite(userId: string, productId: string) {
  await prisma.favorite.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
  return { ok: true };
}

export async function removeFavorite(userId: string, productId: string) {
  await prisma.favorite.deleteMany({
    where: { userId, productId },
  });
  return { ok: true };
}
