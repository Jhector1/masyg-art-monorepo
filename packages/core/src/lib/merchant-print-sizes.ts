/**
 * Atomic print-size authoring: ProductVariant and canonical InventoryLevel only.
 * No shadow inventory, new checkout model or automatic publication.
 */
import { z } from 'zod';
import { prisma } from './prisma';
import { requireMerchantAccess, TenantAccessError, validateTenantId } from './tenancy';
import { CatalogStateError } from './catalog-lifecycle';
import { catalogVariantInput } from './catalog-contract';
import { validatePrintSizeDrafts } from './catalog-option-authoring';
import { existingPrintConfigurationKey, normalizePrintSku, validatePrintBatch } from './print-size-batch-policy';

const maxInt = 2147483647;
const row = z.object({
  width: z.number().finite(), height: z.number().finite(), unit: z.enum(['in', 'cm']),
  priceMinor: z.number().int().safe().min(0).max(maxInt),
  compareAtMinor: z.number().int().safe().min(1).max(maxInt).optional(),
  sku: z.string().trim().min(1).max(100),
  stock: z.number().int().safe().min(0).max(maxInt),
}).strict();
export const merchantPrintBatchInput = z.object({
  storeId: z.string().min(3).max(128), offeringId: z.string().min(3).max(128),
  locationId: z.string().min(3).max(128).optional(),
  material: z.string().trim().min(1).max(100), finish: z.string().trim().min(1).max(100),
  frame: z.string().trim().min(1).max(100), glazing: z.string().trim().min(1).max(100),
  currency: z.literal('USD'), sizes: z.array(row).min(1).max(40),
}).strict();

const conflictCode = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;

export async function listMerchantPrintSizes(args: {
  userId: string; organizationId: string; storeId: string; productId: string;
}) {
  const access = await requireMerchantAccess({ ...args, capability: 'read' });
  const productId = validateTenantId(args.productId);
  const listed = await prisma.storeListing.findUnique({ where: { organizationId_storeId_productId: {
    organizationId: access.organizationId, storeId: access.storeId!, productId,
  } }, select: { productId: true } });
  if (!listed) throw new TenantAccessError(404);
  const [offerings, locations, variants] = await Promise.all([
    prisma.productOffering.findMany({ where: { organizationId: access.organizationId, productId, kind: 'PRINT' },
      select: { id: true, name: true }, orderBy: { createdAt: 'asc' } }),
    prisma.inventoryLocation.findMany({ where: { organizationId: access.organizationId }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 100 }),
    prisma.productVariant.findMany({ where: { organizationId: access.organizationId, productId, fulfillment: 'PHYSICAL' },
      select: { id: true, offeringId: true, name: true, sku: true, priceMinor: true, active: true, attributes: true },
      orderBy: { createdAt: 'asc' }, take: 500 }),
  ]);
  return { offerings, locations, variants, variantsCappedAt: 500 };
}

/** A single serializable commit creates all size variants and their initial stock (if any). */
export async function createMerchantPrintSizes(args: {
  userId: string; organizationId: string; productId: string; input: unknown;
}) {
  // Organization-wide catalog editing remains OWNER/ADMIN, not store MEMBER.
  const access = await requireMerchantAccess({ userId: args.userId, organizationId: args.organizationId, capability: 'manage' });
  const productId = validateTenantId(args.productId);
  const input = merchantPrintBatchInput.parse(args.input);
  const storeId = validateTenantId(input.storeId);
  const offeringId = validateTenantId(input.offeringId);
  const locationId = input.locationId ? validateTenantId(input.locationId) : undefined;
  if (input.sizes.some(size => size.stock > 0) && !locationId) {
    throw new CatalogStateError('Choose a stock location when adding positive stock');
  }
  const sizes = validatePrintSizeDrafts(input.sizes);
  if (!sizes.ok) throw new CatalogStateError(sizes.errors.map(error => error.message).join(' '));
  const options = { material: input.material, finish: input.finish, frame: input.frame, glazing: input.glazing };
  const preflightErrors = validatePrintBatch(input.sizes, new Set<string>(), options);
  if (preflightErrors.length) throw new CatalogStateError(preflightErrors.join('. '));

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const [listing, offering, location, variants] = await Promise.all([
          tx.storeListing.findUnique({ where: { organizationId_storeId_productId: { organizationId: access.organizationId, storeId, productId } },
            select: { product: { select: { status: true } } } }),
          tx.productOffering.findFirst({ where: { organizationId: access.organizationId, productId, id: offeringId, kind: 'PRINT' }, select: { id: true } }),
          locationId ? tx.inventoryLocation.findFirst({ where: { organizationId: access.organizationId, id: locationId }, select: { id: true } }) : Promise.resolve(null),
          tx.productVariant.findMany({ where: { organizationId: access.organizationId, productId, fulfillment: 'PHYSICAL' },
            select: { attributes: true } }),
        ]);
        if (!listing || listing.product.status === 'ARCHIVED' || !offering) throw new TenantAccessError(404);
        if (locationId && !location) throw new TenantAccessError(404);
        const known = new Set<string>(variants.map(variant => existingPrintConfigurationKey(variant.attributes)).filter((key): key is string => key !== null));
        const errors = validatePrintBatch(input.sizes, known, options);
        if (errors.length) throw new CatalogStateError(errors.join('. '));

        const skus = input.sizes.map(size => normalizePrintSku(size.sku));
        const used = await tx.productVariant.findFirst({ where: {
          organizationId: access.organizationId, OR: skus.map(sku => ({ sku: { equals: sku, mode: 'insensitive' as const } })),
        }, select: { sku: true } });
        if (used) throw new CatalogStateError(`SKU ${used.sku ?? ''} already belongs to a variant in this organization`);

        const created: { id: string; name: string; sku: string | null; priceMinor: number; stock: number }[] = [];
        for (const [index, size] of sizes.value.entries()) {
          const requested = input.sizes[index];
          const variantInput = catalogVariantInput.parse({
            name: `${size.label} print`, sku: normalizePrintSku(requested.sku), fulfillment: 'PHYSICAL',
            priceMinor: requested.priceMinor, compareAtMinor: requested.compareAtMinor, currency: input.currency,
            attributes: { size: size.label, ...options },
          });
          const variant = await tx.productVariant.create({ data: {
            organizationId: access.organizationId, productId, offeringId,
            name: variantInput.name, sku: variantInput.sku,
            fulfillment: 'PHYSICAL', currency: variantInput.currency,
            priceMinor: variantInput.priceMinor, compareAtMinor: variantInput.compareAtMinor,
            attributes: variantInput.attributes, inventoryPolicy: 'TRACKED', active: false,
          }, select: { id: true, name: true, sku: true, priceMinor: true } });
          if (requested.stock > 0 && locationId) {
            await tx.inventoryLevel.create({ data: {
              organizationId: access.organizationId, variantId: variant.id, locationId,
              onHand: requested.stock, reserved: 0,
            } });
            await tx.merchantAuditLog.create({ data: {
              organizationId: access.organizationId, actorUserId: args.userId, action: 'inventory.stock.initialized',
              targetType: 'ProductVariant', targetId: variant.id,
              metadata: { storeId, locationId, delta: requested.stock, before: 0, after: requested.stock, reason: 'Initial print size stock' },
            } });
          }
          await tx.merchantAuditLog.create({ data: {
            organizationId: access.organizationId, actorUserId: args.userId, action: 'catalog.print_variant.created',
            targetType: 'ProductVariant', targetId: variant.id,
            metadata: { offeringId, storeId, initialStock: requested.stock },
          } });
          created.push({ ...variant, stock: requested.stock });
        }
        return { created, count: created.length, active: false };
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 });
    } catch (error) {
      if (conflictCode(error, 'P2034')) {
        if (attempt < 2) continue;
        throw new CatalogStateError('A concurrent size change occurred; refresh and retry');
      }
      if (conflictCode(error, 'P2002')) throw new CatalogStateError('A print variant or SKU already exists; reload before retrying');
      throw error;
    }
  }
  throw new CatalogStateError('Concurrent print size updates; please retry');
}
