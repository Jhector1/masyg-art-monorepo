/**
 * Merchant-owned option vocabulary (v39D.2).
 * These records are authoring metadata; only ProductVariant is purchasable.
 * No checkout, inventory or price changes occur here.
 */
import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';
import { requireMerchantAccess, TenantAccessError, validateTenantId } from './tenancy';
import { CatalogStateError } from './catalog-lifecycle';
import { validateOptionGroupDrafts, type NormalizedOptionGroup } from './catalog-option-authoring';
import { validateNewOptionChoices } from './catalog-option-merge-policy';

function normalizeGroup(name: string, values: readonly string[]): NormalizedOptionGroup {
  const outcome = validateOptionGroupDrafts([{ name, values }]);
  if (!outcome.ok) throw new CatalogStateError(outcome.errors.map(error => error.message).join(' '));
  return outcome.value[0];
}

async function ensureMutableProduct(tx: Prisma.TransactionClient, organizationId: string, productId: string) {
  const product = await tx.product.findFirst({
    where: { organizationId, id: productId, status: { not: 'ARCHIVED' } },
    select: { id: true },
  });
  if (!product) throw new TenantAccessError(404);
}

/** A store-scoped read must verify that the product is listed in that store. */
export async function getMerchantCatalogOptionGroups(args: {
  userId: string; organizationId: string; storeId: string; productId: string;
}) {
  const access = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId,
    storeId: args.storeId, capability: 'read',
  });
  const productId = validateTenantId(args.productId);
  const listing = await prisma.storeListing.findFirst({
    where: { organizationId: access.organizationId, storeId: access.storeId!, productId },
    select: { productId: true },
  });
  if (!listing) throw new TenantAccessError(404);
  const [groups, offerings] = await Promise.all([
    prisma.catalogOptionGroup.findMany({
      where: { organizationId: access.organizationId, active: true },
      select: {
        id: true, name: true, key: true,
        values: { where: { active: true }, select: { id: true, key: true, label: true, sortOrder: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        offerings: { where: { organizationId: access.organizationId, productId }, select: { offeringId: true, required: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.productOffering.findMany({
      where: { organizationId: access.organizationId, productId },
      select: { id: true, name: true, kind: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);
  return { groups, offerings };
}

/** Only organization OWNER/ADMIN can create reusable option definitions. */
export async function createMerchantCatalogOptionGroup(args: {
  userId: string; organizationId: string; productId: string; name: string; values: readonly string[];
}) {
  const access = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: 'manage' });
  const productId = validateTenantId(args.productId);
  const normalized = normalizeGroup(args.name, args.values);
  return prisma.$transaction(async tx => {
    await ensureMutableProduct(tx, access.organizationId, productId);
    const group = await tx.catalogOptionGroup.create({
      data: { organizationId: access.organizationId, key: normalized.key, name: normalized.name },
      select: { id: true, name: true },
    });
    await tx.catalogOptionValue.createMany({
      data: normalized.values.map((value, index) => ({
        organizationId: access.organizationId, groupId: group.id,
        key: value.key, label: value.label, sortOrder: index,
      })),
    });
    await tx.merchantAuditLog.create({ data: {
      organizationId: access.organizationId, actorUserId: args.userId,
      action: 'catalog.option_group.created', targetType: 'CatalogOptionGroup', targetId: group.id,
    }});
    return group;
  });
}

/** Append choices without changing previously stored IDs, SKUs, or associations. */
export async function addMerchantCatalogOptionValues(args: {
  userId: string; organizationId: string; productId: string; groupId: string; values: readonly string[];
}) {
  const access = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: 'manage' });
  const productId = validateTenantId(args.productId);
  const groupId = validateTenantId(args.groupId);
  return prisma.$transaction(async tx => {
    await ensureMutableProduct(tx, access.organizationId, productId);
    const group = await tx.catalogOptionGroup.findFirst({
      where: { id: groupId, organizationId: access.organizationId, active: true },
      select: { id: true, name: true, values: { select: { key: true, sortOrder: true } } },
    });
    if (!group) throw new TenantAccessError(404);
    const proposed = validateNewOptionChoices(group.name, args.values, new Set(group.values.map(value => value.key)));
    if (!proposed.ok) throw new CatalogStateError(proposed.errors.map(error => error.message).join(' '));
    const nextOrder = Math.max(-1, ...group.values.map(value => value.sortOrder)) + 1;
    await tx.catalogOptionValue.createMany({ data: proposed.value.map((value, index) => ({
      organizationId: access.organizationId, groupId, key: value.key, label: value.label, sortOrder: nextOrder + index,
    })) });
    await tx.merchantAuditLog.create({ data: {
      organizationId: access.organizationId, actorUserId: args.userId,
      action: 'catalog.option_values.added', targetType: 'CatalogOptionGroup', targetId: groupId,
    }});
    return { groupId, added: proposed.value.length };
  });
}

/** Link/unlink vocabulary only; does NOT generate purchasable variants. */
export async function setMerchantOfferingOptionGroup(args: {
  userId: string; organizationId: string; productId: string; offeringId: string; groupId: string;
  linked: boolean; required?: boolean;
}) {
  const access = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: 'manage' });
  const productId = validateTenantId(args.productId);
  const offeringId = validateTenantId(args.offeringId);
  const groupId = validateTenantId(args.groupId);
  return prisma.$transaction(async tx => {
    await ensureMutableProduct(tx, access.organizationId, productId);
    const [offering, group] = await Promise.all([
      tx.productOffering.findFirst({ where: { id: offeringId, organizationId: access.organizationId, productId }, select: { id: true } }),
      tx.catalogOptionGroup.findFirst({ where: { id: groupId, organizationId: access.organizationId, active: true }, select: { id: true } }),
    ]);
    if (!offering || !group) throw new TenantAccessError(404);
    const key = { organizationId: access.organizationId, productId, offeringId, groupId };
    if (args.linked) {
      await tx.offeringOptionGroup.upsert({
        where: { organizationId_productId_offeringId_groupId: key },
        update: { required: args.required ?? false },
        create: { ...key, required: args.required ?? false },
      });
    } else {
      await tx.offeringOptionGroup.deleteMany({ where: key });
    }
    await tx.merchantAuditLog.create({ data: {
      organizationId: access.organizationId, actorUserId: args.userId,
      action: args.linked ? 'catalog.option_group.linked' : 'catalog.option_group.unlinked',
      targetType: 'ProductOffering', targetId: offeringId,
    }});
    return { groupId, offeringId, linked: args.linked };
  });
}
