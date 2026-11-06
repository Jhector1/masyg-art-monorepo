import { prisma } from "@acme/core/lib/prisma";
import { z } from "zod";
import { CatalogStateError } from "./catalog-lifecycle";
import { requireMerchantAccess, TenantAccessError, validateTenantId, validateSlug } from "./tenancy";

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().min(1).max(63),
}).strict();
export const categoryIdsInput = z.object({
  categoryIds: z.array(z.string().min(3).max(128)).max(50)
    .refine(ids => new Set(ids).size === ids.length, "Duplicate categories"),
}).strict();

/** Category vocabulary and assignments belong to the organization, never to an arbitrary global Admin user. */
export async function listMerchantCategories(userId: string, organizationId: string) {
  const scope = await requireMerchantAccess({ userId, organizationId, capability: "read" });
  return prisma.category.findMany({
    where: { organizationId: scope.organizationId },
    select: { id: true, name: true, slug: true, _count: { select: { productLinks: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }], take: 200,
  });
}
export async function createMerchantCategory(userId: string, organizationId: string, body: unknown) {
  const scope = await requireMerchantAccess({ userId, organizationId, capability: "manage" });
  const input = categoryInput.parse(body);
  const category = await prisma.category.create({
    data: { organizationId: scope.organizationId, name: input.name, slug: validateSlug(input.slug) },
  });
  await prisma.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: userId,
    action: "catalog.category.created", targetType: "Category", targetId: category.id } });
  return category;
}
export async function updateMerchantCategory(userId: string, organizationId: string, categoryId: string, body: unknown) {
  const scope = await requireMerchantAccess({ userId, organizationId, capability: "manage" });
  const input = categoryInput.parse(body);
  const id = validateTenantId(categoryId);
  const result = await prisma.category.updateMany({
    where: { id, organizationId: scope.organizationId },
    data: { name: input.name, slug: validateSlug(input.slug) },
  });
  if (result.count !== 1) throw new TenantAccessError(404);
  await prisma.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: userId,
    action: "catalog.category.updated", targetType: "Category", targetId: id } });
  return prisma.category.findUnique({ where: { organizationId_id: { organizationId: scope.organizationId, id } } });
}
export async function removeMerchantCategory(userId: string, organizationId: string, categoryId: string) {
  const scope = await requireMerchantAccess({ userId, organizationId, capability: "manage" });
  const id = validateTenantId(categoryId);
  const category = await prisma.category.findFirst({ where: { id, organizationId: scope.organizationId },
    select: { _count: { select: { productLinks: true } } } });
  if (!category) throw new TenantAccessError(404);
  if (category._count.productLinks) throw new CatalogStateError("Remove category assignments before deleting it");
  const result = await prisma.category.deleteMany({ where: { id, organizationId: scope.organizationId, productLinks: { none: {} } } });
  if (result.count !== 1) throw new CatalogStateError("Category changed; retry deletion");
  await prisma.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: userId,
    action: "catalog.category.deleted", targetType: "Category", targetId: id } });
  return { deleted: true };
}
export async function setMerchantProductCategories(args: { userId: string; organizationId: string; productId: string; body: unknown }) {
  const scope = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: "manage" });
  const productId = validateTenantId(args.productId);
  const ids = categoryIdsInput.parse(args.body).categoryIds.map(validateTenantId);
  return prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({ where: { id: productId, organizationId: scope.organizationId,
      status: { not: "ARCHIVED" } }, select: { id: true } });
    if (!product) throw new TenantAccessError(404);
    const matched = await tx.category.count({ where: { organizationId: scope.organizationId, id: { in: ids } } });
    if (matched !== ids.length) throw new TenantAccessError(404);
    await tx.productCategory.deleteMany({ where: { organizationId: scope.organizationId, productId } });
    if (ids.length) await tx.productCategory.createMany({ data: ids.map(categoryId => ({
      organizationId: scope.organizationId, productId, categoryId,
    })) });
    await tx.merchantAuditLog.create({ data: { organizationId: scope.organizationId, actorUserId: args.userId,
      action: "catalog.product.categories.updated", targetType: "Product", targetId: productId,
      metadata: { categoryCount: ids.length } } });
    return { categoryIds: ids };
  }, { maxWait: 10000, timeout: 15000 });
}
