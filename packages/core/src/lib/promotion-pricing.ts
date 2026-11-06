/**
 * V39A server-only, pure discount policy. This is NOT connected to checkout.
 * Currency, identity, base prices and eligible rules must come from trusted DB
 * reads; never deserialize arbitrary browser JSON into a trusted quote.
 *
 * Price calculations use integer minor units and bigint intermediates. One
 * best discount is selected per line; stacking is intentionally unsupported.
 */
const MAX_MINOR = 2_147_483_647;

export class PricingPolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PricingPolicyError";
  }
}

export type TrustedPriceLine = Readonly<{
  variantId: string;
  productId: string;
  organizationId: string;
  storeId: string;
  currency: string;
  quantity: number;
  unitPriceMinor: number;
}>;

export type PromotionTarget =
  | Readonly<{type: "ORGANIZATION"}>
  | Readonly<{type: "STORES"; storeIds: readonly string[]}>
  | Readonly<{type: "PRODUCTS"; productIds: readonly string[]; storeIds?: readonly string[]}>;

export type PromotionBenefit =
  | Readonly<{type: "PERCENT"; basisPoints: number}>
  | Readonly<{type: "AMOUNT_PER_UNIT"; amountMinor: number}>;

export type TrustedPromotionRule = Readonly<{
  id: string;
  organizationId: string;
  currency: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
  startsAt?: Date;
  endsAt?: Date;
  target: PromotionTarget;
  activation: "AUTOMATIC" | "CODE";
  code?: string;
  priority: number;
  benefit: PromotionBenefit;
}>;

export type DiscountLine = Readonly<{
  variantId: string;
  productId: string;
  quantity: number;
  unitPriceMinor: number;
  baseMinor: number;
  discountMinor: number;
  netMinor: number;
  promotionId: string | null;
}>;

export type DiscountPreview = Readonly<{
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  netSubtotalMinor: number;
  lines: readonly DiscountLine[];
}>;

function whole(value: number, field: string, min = 0): number {
  if (!Number.isSafeInteger(value) || value < min || value > MAX_MINOR) {
    throw new PricingPolicyError("INVALID_AMOUNT", `${field} is outside supported minor-unit bounds`);
  }
  return value;
}

function addMinor(a: number, b: number): number {
  return whole(a + b, "total");
}

function currency(value: string): void {
  if (!/^[A-Z]{3}$/.test(value)) throw new PricingPolicyError("INVALID_CURRENCY", "Currency must be ISO 4217 uppercase");
}

function ensureRule(rule: TrustedPromotionRule): void {
  if (!rule.id || !rule.organizationId || !Number.isSafeInteger(rule.priority) ||
      rule.priority < -1000 || rule.priority > 1000) {
    throw new PricingPolicyError("INVALID_PROMOTION", "Invalid promotion identity or priority");
  }
  currency(rule.currency);
  if (!(["ACTIVE", "DRAFT", "PAUSED", "EXPIRED"] as const).includes(rule.status))
    throw new PricingPolicyError("INVALID_PROMOTION", "Invalid promotion status");
  if (rule.activation !== "AUTOMATIC" && rule.activation !== "CODE")
    throw new PricingPolicyError("INVALID_PROMOTION", "Invalid promotion activation");
  if (rule.activation === "CODE" && (!rule.code || !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(rule.code)))
    throw new PricingPolicyError("INVALID_PROMOTION", "Invalid coupon code");
  if (rule.startsAt !== undefined && (!(rule.startsAt instanceof Date) || !Number.isFinite(rule.startsAt.getTime())))
    throw new PricingPolicyError("INVALID_PROMOTION", "Invalid start date");
  if (rule.endsAt !== undefined && (!(rule.endsAt instanceof Date) || !Number.isFinite(rule.endsAt.getTime())))
    throw new PricingPolicyError("INVALID_PROMOTION", "Invalid end date");
  if (rule.startsAt && rule.endsAt && rule.startsAt >= rule.endsAt)
    throw new PricingPolicyError("INVALID_PROMOTION", "Promotion start must precede end");
  if (rule.target.type === "STORES") {
    if (!rule.target.storeIds.length || new Set(rule.target.storeIds).size !== rule.target.storeIds.length)
      throw new PricingPolicyError("INVALID_PROMOTION", "Store targets must be unique and nonempty");
  } else if (rule.target.type === "PRODUCTS") {
    if (!rule.target.productIds.length || new Set(rule.target.productIds).size !== rule.target.productIds.length ||
       (rule.target.storeIds && new Set(rule.target.storeIds).size !== rule.target.storeIds.length))
      throw new PricingPolicyError("INVALID_PROMOTION", "Product/store targets must be unique and nonempty");
  } else if (rule.target.type !== "ORGANIZATION") {
    throw new PricingPolicyError("INVALID_PROMOTION", "Invalid promotion target");
  }
  if (rule.benefit.type === "PERCENT") {
    whole(rule.benefit.basisPoints, "basisPoints", 1);
    if (rule.benefit.basisPoints > 10000) throw new PricingPolicyError("INVALID_PROMOTION", "Discount cannot exceed 100%");
  } else if (rule.benefit.type === "AMOUNT_PER_UNIT") {
    whole(rule.benefit.amountMinor, "amountMinor", 1);
  } else {
    throw new PricingPolicyError("INVALID_PROMOTION", "Unsupported promotion benefit");
  }
}

function eligible(rule: TrustedPromotionRule, line: TrustedPriceLine, now: Date, code?: string): boolean {
  if (rule.status !== "ACTIVE" || rule.currency !== line.currency) return false;
  if (rule.startsAt && now < rule.startsAt) return false;
  if (rule.endsAt && now >= rule.endsAt) return false;
  if (rule.activation === "CODE" && rule.code !== code) return false;
  const target = rule.target;
  if (target.type === "ORGANIZATION") return true;
  if (target.type === "STORES") return target.storeIds.includes(line.storeId);
  return target.productIds.includes(line.productId) &&
    (!target.storeIds || target.storeIds.includes(line.storeId));
}

function discount(rule: TrustedPromotionRule, baseMinor: number, quantity: number): number {
  const benefit = rule.benefit;
  const raw = benefit.type === "PERCENT"
    ? (BigInt(baseMinor) * BigInt(benefit.basisPoints) + 5000n) / 10000n
    : BigInt(benefit.amountMinor) * BigInt(quantity);
  return Number(raw > BigInt(baseMinor) ? BigInt(baseMinor) : raw);
}

/** Draft, inactive, out-of-scope and expired promotions never change a quote. */
export function previewNonStackingDiscounts(args: {
  organizationId: string;
  storeId: string;
  currency: string;
  now: Date;
  couponCode?: string;
  lines: readonly TrustedPriceLine[];
  promotions: readonly TrustedPromotionRule[];
}): DiscountPreview {
  currency(args.currency);
  if (!args.organizationId || !args.storeId || !(args.now instanceof Date) ||
      !Number.isFinite(args.now.getTime()) || args.lines.length < 1 || args.lines.length > 100 ||
      args.promotions.length > 100) {
    throw new PricingPolicyError("INVALID_CONTEXT", "Invalid trusted pricing context");
  }
  const normalizedCode = args.couponCode?.trim().toUpperCase();
  if (normalizedCode && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalizedCode))
    throw new PricingPolicyError("INVALID_COUPON", "Invalid coupon code format");
  const seenVariants = new Set<string>();
  let subtotalMinor = 0;
  for (const line of args.lines) {
    if (!line.variantId || !line.productId || seenVariants.has(line.variantId))
      throw new PricingPolicyError("INVALID_LINE", "Duplicate or unidentified checkout variant");
    seenVariants.add(line.variantId);
    if (line.organizationId !== args.organizationId || line.storeId !== args.storeId)
      throw new PricingPolicyError("TENANT_SCOPE_MISMATCH", "Cross-tenant/cross-store pricing refused");
    if (line.currency !== args.currency) throw new PricingPolicyError("INVALID_CURRENCY", "Mixed cart currencies refused");
    whole(line.quantity, "quantity", 1);
    if (line.quantity > 20) throw new PricingPolicyError("INVALID_QUANTITY", "Cart line exceeds 20 units");
    whole(line.unitPriceMinor, "unitPriceMinor");
    subtotalMinor = addMinor(subtotalMinor, whole(line.quantity * line.unitPriceMinor, "line subtotal"));
  }
  const seenRules = new Set<string>();
  for (const rule of args.promotions) {
    ensureRule(rule);
    if (rule.organizationId !== args.organizationId)
      throw new PricingPolicyError("TENANT_SCOPE_MISMATCH", "Foreign organization's promotion refused");
    if (seenRules.has(rule.id)) throw new PricingPolicyError("INVALID_PROMOTION", "Duplicate promotion identity");
    seenRules.add(rule.id);
  }
  let discountMinor = 0;
  const lines = args.lines.map(line => {
    const baseMinor = line.quantity * line.unitPriceMinor;
    let winner: TrustedPromotionRule | null = null;
    let bestMinor = 0;
    for (const rule of args.promotions) {
      if (!eligible(rule, line, args.now, normalizedCode)) continue;
      const reduction = discount(rule, baseMinor, line.quantity);
      if (reduction > bestMinor || (reduction > 0 && reduction === bestMinor &&
          (winner === null || rule.priority > winner.priority ||
            (rule.priority === winner.priority && rule.id < winner.id)))) {
        winner = rule;
        bestMinor = reduction;
      }
    }
    discountMinor = addMinor(discountMinor, bestMinor);
    return {
      variantId: line.variantId, productId: line.productId, quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor, baseMinor, discountMinor: bestMinor,
      netMinor: baseMinor - bestMinor, promotionId: winner?.id ?? null,
    };
  });
  return {currency: args.currency, subtotalMinor, discountMinor, netSubtotalMinor: subtotalMinor - discountMinor, lines};
}
