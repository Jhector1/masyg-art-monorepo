import { z } from "zod";
import { physicalOptionsReady,physicalOptionsAllowed } from "./physical-options";
import { duplicateLicenseTier } from "./digital-license-policy";

/** Artwork properties are metadata; never put monetary amounts in this JSON. */
export const artworkAttributes = z.object({
  size: z.string().trim().max(80).optional(),
  material: z.string().trim().max(100).optional(),
  format: z.string().trim().max(80).optional(),
  edition: z.string().trim().max(100).optional(),
  finish: z.string().trim().max(100).optional(),
  license: z.enum(["personal", "commercial", "extended"]).optional(),
  frame: z.string().trim().max(100).optional(),
  glazing: z.string().trim().max(100).optional(),
}).strict();


// One catalog. PHYSICAL and DIGITAL are per purchasable variant, never store types.
export const catalogVariantInput = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(100).optional(),
  fulfillment: z.enum(["PHYSICAL", "DIGITAL"]),
  priceMinor: z.number().int().safe().min(0).max(2147483647),
  compareAtMinor: z.number().int().safe().min(1).max(2147483647).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  attributes: artworkAttributes.optional(),
}).strict().refine(v => v.compareAtMinor === undefined || v.compareAtMinor > v.priceMinor, {
  message: "Regular price must be greater than the current selling price", path: ["compareAtMinor"],
}).refine(v => v.fulfillment === "DIGITAL" || !v.attributes?.license, {
  message: "Licenses apply only to digital editions", path: ["attributes", "license"],
}).refine(v => v.fulfillment === "PHYSICAL" || !(v.attributes?.frame || v.attributes?.glazing), {
  message: "Frames and protective glazing apply only to physical editions", path: ["attributes", "frame"],
});

const catalogCreateBase = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(10000).optional(),
  variants: z.array(catalogVariantInput).min(1).max(100),
  offersDigitalLicenses: z.boolean().optional().default(false),
  offersFraming: z.boolean().optional().default(false),
  offersGlazing: z.boolean().optional().default(false),
}).strict();
function checkLicenseCreation(input: z.infer<typeof catalogCreateBase>, ctx: z.RefinementCtx) {
  const digital = input.variants.filter(v => v.fulfillment === "DIGITAL");
  const tiers = new Set(digital.map(v => v.attributes?.license).filter(Boolean));
  if (input.offersDigitalLicenses && (tiers.size < 2 || digital.some(v => !v.attributes?.license))) {
    ctx.addIssue({ code: "custom", path: ["variants"], message: "Licensed digital products require at least two configured license editions and a license on every digital variant" });
  }
  for (const [index, variant] of input.variants.entries()) {
    if (variant.fulfillment !== "DIGITAL" || !variant.attributes?.license) continue;
    const previous = input.variants.slice(0, index).map(v => ({fulfillment:v.fulfillment,attributes:v.attributes}));
    if (duplicateLicenseTier(previous, variant.attributes.license)) {
      ctx.addIssue({code:"custom",path:["variants",index,"attributes","license"],
        message:"Only one edition per license tier is allowed. Attach multiple formats to that edition as private files."});
    }
  }
  for (const [enabled,key] of [[input.offersFraming,"frame"],[input.offersGlazing,"glazing"]] as const) {
    if (enabled && !physicalOptionsReady(input.variants.filter(v=>physicalOptionsAllowed(input,v.fulfillment,v.attributes)).map(v=>({active:true,fulfillment:v.fulfillment,attributes:v.attributes})),key)) {
      ctx.addIssue({code:"custom",path:[key==="frame"?"offersFraming":"offersGlazing"],message:`Create at least two physical variants with different ${key} choices before enabling`});
    }
  }
}
export const catalogCreateInput = catalogCreateBase.superRefine(checkLicenseCreation);

export const catalogPatchInput = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(10000).optional(),
  offersDigitalLicenses: z.boolean().optional(),
  offersFraming: z.boolean().optional(),
  offersGlazing: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No changes provided");

export const variantPatchInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  priceMinor: z.number().int().safe().min(0).max(2147483647).optional(),
  compareAtMinor: z.number().int().safe().min(1).max(2147483647).nullable().optional(),
  sku: z.string().trim().min(1).max(100).nullable().optional(),
  active: z.boolean().optional(),
  attributes: artworkAttributes.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No changes provided");

export const listingPatchInput = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
}).strict();


/** Merchant creates a product and its first store listing atomically. */
export const storeCatalogCreateInput = catalogCreateBase.extend({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
}).strict().superRefine(checkLicenseCreation);
