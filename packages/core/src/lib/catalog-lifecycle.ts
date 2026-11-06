import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess, TenantAccessError, validateTenantId } from "./tenancy";
import type { PublicationStatus } from "@prisma/client";
import { catalogPatchInput, catalogVariantInput, variantPatchInput } from "./catalog-contract";
import { licenseOf, licensedVariantsReady, licenseAllowed,duplicateLicenseTier } from "./digital-license-policy";
import { physicalOptionsAllowed, physicalOptionsReady, normalizedOption } from "./physical-options";

export class CatalogStateError extends Error {
  readonly status = 409;
  constructor(message: string) { super(message); this.name = "CatalogStateError"; }
}

/** Organization catalog changes require OWNER/ADMIN; store editors may change listings only. */
export async function updateCatalogProduct(args: {
  userId: string; organizationId: string; productId: string; changes: unknown;
}) {
  const scope = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId, capability: "manage",
  });
  const productId = validateTenantId(args.productId);
  const changes = catalogPatchInput.parse(args.changes);
  if (changes.offersDigitalLicenses !== undefined) {
    const current = await prisma.product.findFirst({
      where: { organizationId: scope.organizationId, id: productId, status: { not: "ARCHIVED" } },
      select: { status: true, variants: {select: {
        active: true, fulfillment: true, attributes: true,
        digitalFiles: { where: {retiredAt:null,asset:{private:true}}, select:{id:true} },
      }}},
    });
    if (!current) throw new TenantAccessError(404);
    if (changes.offersDigitalLicenses) {
      if (!licensedVariantsReady(current.variants, current.status === "PUBLISHED"))
        throw new CatalogStateError("Configure at least two active licensed digital editions (each with an attached private file before enabling on a published product)");
    }
  }
  if (changes.offersFraming !== undefined || changes.offersGlazing !== undefined) {
    const product = await prisma.product.findFirst({
      where:{organizationId:scope.organizationId,id:productId,status:{not:"ARCHIVED"}},
      select:{offersFraming:true,offersGlazing:true,variants:{select:{active:true,fulfillment:true,attributes:true}}},
    });
    if (!product) throw new TenantAccessError(404);
    const offers={offersFraming:changes.offersFraming??product.offersFraming,
      offersGlazing:changes.offersGlazing??product.offersGlazing};
    const eligible=product.variants.filter(v=>physicalOptionsAllowed(offers,v.fulfillment,v.attributes));
    for (const [setting,key] of [["offersFraming","frame"],["offersGlazing","glazing"]] as const) {
      if (changes[setting] === true && (
        !eligible.some(v => v.active && v.fulfillment === "PHYSICAL" && normalizedOption(v.attributes,key) !== "none") ||
        !physicalOptionsReady(eligible,key)))
        throw new CatalogStateError(`Create and activate at least two purchasable physical editions with different ${key} options under the selected option settings`);
    }
  }
  const result = await prisma.product.updateMany({
    where: { organizationId: scope.organizationId, id: productId, status: { not: "ARCHIVED" } },
    data: changes,
  });
  if (result.count !== 1) throw new TenantAccessError(404);
  return prisma.product.findUnique({
    where: { organizationId_id: { organizationId: scope.organizationId, id: productId } },
    include: { variants: true },
  });
}

/** Changing variant pricing never overwrites a previous order-item price snapshot. */
export async function updateCatalogVariant(args: {
  userId: string; organizationId: string; productId: string; variantId: string; changes: unknown;
}) {
  const scope = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId, capability: "manage",
  });
  const productId = validateTenantId(args.productId);
  const variantId = validateTenantId(args.variantId);
  const changes = variantPatchInput.parse(args.changes);
  return prisma.$transaction(async (tx) => {
  const old = await tx.productVariant.findFirst({
    where: { organizationId: scope.organizationId, productId, id: variantId },
    select: { priceMinor: true, compareAtMinor: true, attributes: true, fulfillment: true, active: true, product:{select:{offersDigitalLicenses:true,offersFraming:true,offersGlazing:true}} },
  });
  if (!old) throw new TenantAccessError(404);
  const attrs = changes.attributes ?? old.attributes;
  if (old.fulfillment === "DIGITAL" && licenseOf(attrs)) {
    const siblings = await tx.productVariant.findMany({
      where:{organizationId:scope.organizationId,productId,fulfillment:"DIGITAL",id:{not:variantId}},
      select:{id:true,fulfillment:true,attributes:true},
    });
    if (duplicateLicenseTier(siblings,licenseOf(attrs)!)) {
      throw new CatalogStateError("This product already has that license tier. Edit the existing edition instead.");
    }
  }
  if (old.fulfillment === "DIGITAL" && old.product.offersDigitalLicenses &&
      (changes.active ?? old.active) && !licenseOf(attrs)) {
    throw new CatalogStateError("A licensed product requires a license tier on every active digital variant");
  }
  if (old.fulfillment === "DIGITAL" && !physicalOptionsAllowed(old.product,"DIGITAL",attrs))
    throw new CatalogStateError("Physical configuration is not supported on digital downloads");
  if (old.fulfillment !== "DIGITAL" && licenseOf(attrs))
    throw new CatalogStateError("A physical variant cannot carry a digital license");
  if (old.fulfillment === "DIGITAL" && changes.active === true && !old.active) {
    const ready = await tx.productVariant.findFirst({
      where:{id:variantId,productId,organizationId:scope.organizationId},
      select:{product:{select:{status:true}},digitalFiles:{where:{retiredAt:null,asset:{private:true}},select:{id:true}}},
    });
    if(ready?.product.status === "PUBLISHED" && !ready.digitalFiles.length)
      throw new CatalogStateError("Attach a private downloadable file before activating this published digital edition");
  }
  const price = changes.priceMinor ?? old.priceMinor;
  const regular = changes.compareAtMinor === undefined ? old.compareAtMinor : changes.compareAtMinor;
  if (regular !== null && regular <= price) {
    throw new CatalogStateError("Regular price must exceed the current selling price");
  }
  const changed = await tx.productVariant.updateMany({
    where: { id: variantId, productId, organizationId: scope.organizationId },
    data: changes,
  });
  if (changed.count !== 1) throw new TenantAccessError(404);
  return tx.productVariant.findUnique({
    where: { organizationId_id: { organizationId: scope.organizationId, id: variantId } },
  });
  }, {isolationLevel:"Serializable"});
}

/** Additional editions are created inactive. Merchant attaches private files and activates them explicitly. */
export async function createCatalogVariant(args: {
  userId: string; organizationId: string; productId: string; input: unknown;
}) {
  const scope = await requireMerchantAccess({userId: args.userId, organizationId: args.organizationId, capability: "manage"});
  const productId = validateTenantId(args.productId);
  const input = catalogVariantInput.parse(args.input);
  return prisma.$transaction(async (tx) => {
  const product = await tx.product.findFirst({
    where: {id: productId, organizationId: scope.organizationId, status: {not:"ARCHIVED"}},
    select: {id:true, offersDigitalLicenses:true},
  });
  if (!product) throw new TenantAccessError(404);
  if (input.fulfillment === "DIGITAL" && !physicalOptionsAllowed({},"DIGITAL",input.attributes))
    throw new CatalogStateError("Physical configuration is not supported on digital downloads");
  if (input.fulfillment === "DIGITAL" && product.offersDigitalLicenses && !licenseOf(input.attributes))
    throw new CatalogStateError("Choose a license tier for this digital edition");
  const tier = input.fulfillment === "DIGITAL" ? licenseOf(input.attributes) : null;
  if (tier) {
    const existing = await tx.productVariant.findMany({
      where:{organizationId:scope.organizationId,productId,fulfillment:"DIGITAL"},
      select:{id:true,fulfillment:true,attributes:true},
    });
    if (duplicateLicenseTier(existing,tier)) {
      throw new CatalogStateError("This product already has that license tier. Edit the existing edition instead.");
    }
  }
  const created = await tx.productVariant.create({data:{
    organizationId:scope.organizationId,productId,name:input.name,sku:input.sku,
    priceMinor:input.priceMinor,compareAtMinor:input.compareAtMinor,currency:input.currency,
    fulfillment:input.fulfillment,inventoryPolicy:input.fulfillment === "DIGITAL" ? "UNLIMITED" : "TRACKED",
    attributes:input.attributes,active:false,
  }});
  await tx.merchantAuditLog.create({data:{
    organizationId:scope.organizationId,actorUserId:args.userId,action:"catalog.variant.created",
    targetType:"ProductVariant",targetId:created.id,
  }});
  return created;
  }, {isolationLevel:"Serializable"});
}

/** Archives products and listings; never deletes sold order items or customer purchases. */
export async function archiveCatalogProduct(args: {
  userId: string; organizationId: string; productId: string;
}) {
  const scope = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId, capability: "manage",
  });
  const productId = validateTenantId(args.productId);
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { organizationId: scope.organizationId, id: productId },
      select: { id: true },
    });
    if (!product) throw new TenantAccessError(404);
    await tx.product.update({
      where: { organizationId_id: { organizationId: scope.organizationId, id: productId } },
      data: { status: "ARCHIVED" },
    });
    await tx.storeListing.updateMany({
      where: { organizationId: scope.organizationId, productId },
      data: { status: "ARCHIVED" },
    });
    await tx.merchantAuditLog.create({ data: {
      organizationId: scope.organizationId, actorUserId: args.userId,
      action: "catalog.product.archived", targetType: "Product", targetId: productId,
    } });
    return { archived: true, productId };
  });
}

/** Validate sellability before enabling a product in the organization's catalog. */
export async function publishCatalogProduct(args: {
  userId: string; organizationId: string; productId: string;
}) {
  const scope = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId, capability: "manage",
  });
  const productId = validateTenantId(args.productId);
  const product = await prisma.product.findFirst({
    where: { organizationId: scope.organizationId, id: productId, status: { not: "ARCHIVED" } },
    select: { offersDigitalLicenses:true, offersFraming:true, offersGlazing:true, variants: { select: {
      active: true, fulfillment: true, attributes:true, priceMinor: true,
      digitalFiles: { where: { retiredAt: null }, select: { id: true, asset: { select: { private: true } } } },
    } } },
  });
  if (!product) throw new TenantAccessError(404);
  if (product.offersDigitalLicenses && !licensedVariantsReady(product.variants, true)) {
    throw new CatalogStateError("Licensed products need at least two active license editions with private files");
  }
  if (product.variants.some(v => v.active && !physicalOptionsAllowed(product,v.fulfillment,v.attributes))) {
    throw new CatalogStateError("Active physical editions do not match framing/glazing opt-in settings");
  }
  if (product.variants.some(v => v.active && !licenseAllowed(product.offersDigitalLicenses,v.fulfillment,v.attributes))) {
    throw new CatalogStateError("Digital license editions do not match the product's licensing setting");
  }
  const available = product.variants.filter((v) => v.active && Number.isSafeInteger(v.priceMinor) && v.priceMinor >= 0);
  if (!available.length || available.some((v) => v.fulfillment === "DIGITAL" && !v.digitalFiles.some((f) => f.asset.private))) {
    throw new CatalogStateError("Product needs an active purchasable variant and private files for digital variants");
  }
  const updated = await prisma.product.updateMany({
    where: { organizationId: scope.organizationId, id: productId, status: { not: "ARCHIVED" } },
    data: { status: "PUBLISHED" },
  });
  if (updated.count !== 1) throw new TenantAccessError(404);
  return prisma.product.findUnique({
    where: { organizationId_id: { organizationId: scope.organizationId, id: productId } },
  });
}

/** Store-specific publication never changes another store's listing. */
export async function setStoreListingStatus(args: {
  userId: string; organizationId: string; storeId: string; productId: string;
  status: PublicationStatus;
}) {
  const scope = await requireMerchantAccess({
    userId: args.userId, organizationId: args.organizationId,
    storeId: args.storeId, capability: "write",
  });
  const productId = validateTenantId(args.productId);
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(args.status)) {
    throw new Error("Invalid publication status");
  }
  const where = { organizationId: scope.organizationId, storeId: scope.storeId!, productId };
  const listing = await prisma.storeListing.findUnique({
    where: { organizationId_storeId_productId: where },
    select: { product: { select: { status: true } } },
  });
  if (!listing) throw new TenantAccessError(404);
  if (args.status === "PUBLISHED" && listing.product.status !== "PUBLISHED") {
    throw new CatalogStateError("Publish the merchant catalog product before publishing a store listing");
  }
  const updated = await prisma.storeListing.updateMany({
    where: { ...where, ...(args.status === "PUBLISHED" ? { product: { status: "PUBLISHED" } } : {}) },
    data: { status: args.status },
  });
  if (updated.count !== 1) throw new TenantAccessError(404);
  return prisma.storeListing.findUnique({ where: { organizationId_storeId_productId: where } });
}
