import {previewNonStackingDiscounts, PricingPolicyError, type TrustedPriceLine, type TrustedPromotionRule} from "./promotion-pricing";

const now = new Date("2026-11-04T18:00:00.000Z");
const print: TrustedPriceLine = {variantId:"print",productId:"island",organizationId:"orgA",storeId:"storeA",currency:"USD",quantity:1,unitPriceMinor:4200};
const rule: TrustedPromotionRule = {id:"sale20",organizationId:"orgA",currency:"USD",status:"ACTIVE",priority:0,
  activation:"AUTOMATIC",target:{type:"PRODUCTS",productIds:["island"]},benefit:{type:"PERCENT",basisPoints:2000}};
const preview=(lines: TrustedPriceLine[], promos: TrustedPromotionRule[], couponCode?: string) =>
  previewNonStackingDiscounts({organizationId:"orgA",storeId:"storeA",currency:"USD",now,lines,promotions:promos,couponCode});

describe("v39A promotion policy — not connected to checkout", () => {
  it("preserves canonical total when no promotions exist", () => {
    const value=preview([print],[]);
    expect(value.subtotalMinor).toBe(4200);
    expect(value.discountMinor).toBe(0);
    expect(value.netSubtotalMinor).toBe(4200);
  });
  it("applies product-only 20% to $42 as $33.60 before tax/shipping", () => {
    const value=preview([print], [rule]);
    expect(value.discountMinor).toBe(840);
    expect(value.netSubtotalMinor).toBe(3360);
    expect(value.lines[0].promotionId).toBe("sale20");
  });
  it("never discounts a different product in the same store", () => {
    const value=preview([{...print,variantId:"coffee",productId:"coffee"}], [rule]);
    expect(value.discountMinor).toBe(0);
  });
  it("chooses better of 20% product and 10% storewide, without stacking", () => {
    const store:TrustedPromotionRule={...rule,id:"store10",target:{type:"STORES",storeIds:["storeA"]},benefit:{type:"PERCENT",basisPoints:1000}};
    expect(preview([print],[rule,store]).netSubtotalMinor).toBe(3360);
  });
  it("caps fixed per-unit discount at line price", () => {
    const big:TrustedPromotionRule={...rule,benefit:{type:"AMOUNT_PER_UNIT",amountMinor:2000}};
    const tiny={...print,quantity:2,unitPriceMinor:300};
    expect(preview([tiny],[big]).netSubtotalMinor).toBe(0);
  });
  it("counts fixed per-unit discount by quantity", () => {
    const fixed:TrustedPromotionRule={...rule,benefit:{type:"AMOUNT_PER_UNIT",amountMinor:500}};
    expect(preview([{...print,quantity:2}],[fixed]).discountMinor).toBe(1000);
  });
  it("uses integer rounding for fractional percentage amounts", () => {
    const fractional:TrustedPromotionRule={...rule,benefit:{type:"PERCENT",basisPoints:3333}};
    expect(preview([{...print,unitPriceMinor:1}],[fractional]).discountMinor).toBe(0);
    expect(preview([{...print,unitPriceMinor:2}],[fractional]).discountMinor).toBe(1);
  });
  it("allows same coupon name for independent merchants but refuses foreign promotion objects", () => {
    expect(() => preview([print],[{...rule,organizationId:"orgB"}])).toThrow(PricingPolicyError);
    expect(() => preview([{...print,organizationId:"orgB"}],[])).toThrow();
  });
  it("rejects foreign-store cart lines", () => {
    expect(() => preview([{...print,storeId:"storeB"}],[])).toThrow();
  });
  it("applies explicit all-organization scope only to owning organization", () => {
    const global:TrustedPromotionRule={...rule,target:{type:"ORGANIZATION"}};
    expect(preview([{...print,storeId:"storeA"}],[global]).discountMinor).toBe(840);
  });
  it("respects store target and does not treat global as cross-tenant", () => {
    const store:TrustedPromotionRule={...rule,target:{type:"STORES",storeIds:["storeB"]}};
    expect(preview([print],[store]).discountMinor).toBe(0);
  });
  it("does not apply draft, paused, future, or expired promotions", () => {
    for(const changed of [{status:"DRAFT" as const},{status:"PAUSED" as const},
      {startsAt:new Date("2027-01-01T00:00:00Z")},{endsAt:now}]) {
      expect(preview([print],[{...rule,...changed}]).discountMinor).toBe(0);
    }
  });
  it("only applies code promotions when the correct code is supplied", () => {
    const code:TrustedPromotionRule={...rule,activation:"CODE",code:"WELCOME10"};
    expect(preview([print],[code]).discountMinor).toBe(0);
    expect(preview([print],[code],"welcome10").discountMinor).toBe(840);
    expect(preview([print],[code],"NOTVALID").discountMinor).toBe(0);
  });
  it("is deterministic on tied discounts", () => {
    const same={...rule,id:"aaa"};
    expect(preview([print],[rule,same]).lines[0].promotionId).toBe("aaa");
  });
  it("rejects invalid discount bounds, duplicate variant and overflow", () => {
    expect(()=>preview([print],[{...rule,benefit:{type:"PERCENT",basisPoints:10001}}])).toThrow();
    expect(()=>preview([print,print],[])).toThrow();
    expect(()=>preview([{...print,quantity:20,unitPriceMinor:2147483647}],[])).toThrow();
  });
});
