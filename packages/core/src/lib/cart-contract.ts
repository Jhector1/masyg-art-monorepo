import { z } from "zod";

// Cart input never contains prices, merchant IDs, shipping costs or payment references.
export const guestCartAddInput = z.object({
  variantId: z.string().regex(/^[A-Za-z0-9_-]{3,128}$/),
  quantity: z.number().int().min(1).max(20),
}).strict();
export const guestCartSetInput = z.object({
  variantId: z.string().regex(/^[A-Za-z0-9_-]{3,128}$/),
  quantity: z.number().int().min(0).max(20),
}).strict();
export type GuestCartMutation = z.infer<typeof guestCartSetInput>;

export class CartSafetyError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "CartSafetyError";
  }
}

import { licenseAllowed } from "./digital-license-policy";
import { physicalOptionsAllowed } from "./physical-options";

export type SellableVariant = {
  attributes?: unknown;
  id: string;
  name: string;
  fulfillment: "PHYSICAL" | "DIGITAL";
  inventoryPolicy: "TRACKED" | "UNLIMITED";
  priceMinor: number;
  currency: string;
  active: boolean;
  inventory: Array<{onHand:number; reserved:number}>;
  digitalFiles: Array<{id:string}>;
  product: { offersDigitalLicenses?:boolean; offersFraming?:boolean; offersGlazing?:boolean; id:string; title:string; status: "DRAFT"|"PUBLISHED"|"ARCHIVED"; listings: Array<{status:"DRAFT"|"PUBLISHED"|"ARCHIVED"}> };
};

export function assessVariant(variant: SellableVariant, quantity: number): string | null {
  if (!variant.active || variant.product.status !== "PUBLISHED" ||
      !variant.product.listings.some(listing => listing.status === "PUBLISHED")) return "UNPUBLISHED";
  if (!Number.isSafeInteger(variant.priceMinor) || variant.priceMinor < 0 ||
      !/^[A-Z]{3}$/.test(variant.currency)) return "INVALID_PRICE";
  if (!physicalOptionsAllowed(variant.product,variant.fulfillment,variant.attributes)) return "PHYSICAL_OPTION_NOT_OFFERED";
  if (variant.fulfillment === "DIGITAL") {
    if (!licenseAllowed(variant.product.offersDigitalLicenses === true,variant.fulfillment,variant.attributes)) return "LICENSE_NOT_OFFERED";
    return variant.digitalFiles.length ? null : "FILE_UNAVAILABLE";
  }
  if (variant.inventoryPolicy === "TRACKED") {
    const available = variant.inventory.reduce((sum, level) => sum + Math.max(0, level.onHand - level.reserved), 0);
    if (available < quantity) return "OUT_OF_STOCK";
  }
  return null;
}

/** Safe, display-only selection sourced from the persisted merchant variant metadata. */
function publicSelection(value:unknown): Record<string,string> {
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  const src=value as Record<string,unknown>;
  const result:Record<string,string>={};
  for(const key of ["size","material","frame","glazing","finish","format","license"]){
    const field=src[key];
    if(typeof field==="string" && field.trim() && field.length<=100)result[key]=field.trim();
  }
  return result;
}

// Quotes are informational, never payment authorization or an inventory reservation.
export function quoteLines(lines: Array<{quantity:number; variant: SellableVariant}>) {
  if (lines.length > 100) throw new CartSafetyError(409, "Cart item limit exceeded");
  // Derive the cart currency from the first server-priced variant. Assignments
  // inside Array.map callbacks are not visible to TypeScript control-flow
  // analysis at the return statement, which incorrectly inferred only `null`.
  const currency = lines[0]?.variant.currency ?? null;
  let subtotalMinor = 0;
  const issues: Array<{variantId:string; code:string}> = [];
  const items = lines.map(({quantity, variant}) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      issues.push({variantId:variant.id, code:"INVALID_QUANTITY"});
    }
    if (currency !== null && currency !== variant.currency) {
      issues.push({variantId:variant.id, code:"MIXED_CURRENCY"});
    }
    const availability = assessVariant(variant, quantity);
    if (availability) issues.push({variantId:variant.id, code:availability});
    const lineMinor = variant.priceMinor * quantity;
    if (!Number.isSafeInteger(lineMinor) || !Number.isSafeInteger(subtotalMinor + lineMinor)) {
      throw new CartSafetyError(409, "Invalid cart total");
    }
    subtotalMinor += lineMinor;
    return {
      variantId:variant.id, productId:variant.product.id, title:variant.product.title,
      variantName:variant.name, fulfillment:variant.fulfillment, selection:publicSelection(variant.attributes),
      quantity, unitPriceMinor:variant.priceMinor, lineMinor, currency:variant.currency,
      available:!availability,
    };
  });
  return { items, currency, subtotalMinor, issues,
    readyForCheckout:false as const,
    note:"Pricing preview only. Taxes, shipping, stock reservations and payment are not calculated." };
}
