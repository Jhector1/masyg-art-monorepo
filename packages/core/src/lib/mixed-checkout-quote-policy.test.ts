import { planMixedCheckoutQuote, verifyMixedStripeTaxQuote } from "./mixed-checkout-quote-policy";

const org = "org_test";
const store = "store_test";
const physical = {variantId:"print_8x10",fulfillment:"PHYSICAL" as const,quantity:2,unitPriceMinor:2500,currency:"USD"};
const digital = {variantId:"download",fulfillment:"DIGITAL" as const,quantity:1,unitPriceMinor:1000,currency:"USD"};
const rate = {organizationId:org,storeId:store,methodId:"standard_us",country:"US",region:null,
  currency:"USD",amountMinor:650,enabled:true};
const taxes = [{variantId:physical.variantId,taxCode:"txcd_20030000"},{variantId:digital.variantId,taxCode:"txcd_10000000"}];
const base = () => ({organizationId:org,storeId:store,currency:"USD",lines:[physical,digital],
  destination:{country:"US",region:"IL"},merchantRules:[rate],variantTaxCodes:taxes,shippingTaxCode:"txcd_92010001"});

function code(fn:()=>unknown, expected:string) {
  try { fn(); throw Error("Expected rejection"); }
  catch (error) {
    expect((error as {code?:string}).code).toBe(expected);
  }
}

describe("v39D.5A trusted mixed checkout quote policy",()=>{
  test("calculates physical + digital subtotal and merchant shipping using minor units",()=>{
    const result=planMixedCheckoutQuote(base());
    expect(result.subtotalMinor).toBe(6000);
    expect(result.shippingMinor).toBe(650);
    expect(result.shippingMethodId).toBe("standard_us");
    expect(result.hasPhysical).toBe(true);
    expect(result.hasDigital).toBe(true);
    expect(result.taxLines).toEqual([
      {reference:"print_8x10",amount:5000,tax_behavior:"exclusive",tax_code:"txcd_20030000"},
      {reference:"download",amount:1000,tax_behavior:"exclusive",tax_code:"txcd_10000000"},
    ]);
  });
  test("digital-only needs no shipping rate or address",()=>{
    expect(planMixedCheckoutQuote({...base(),lines:[digital],variantTaxCodes:[taxes[1]!],
      destination:undefined,merchantRules:[],shippingTaxCode:undefined}).shippingMinor).toBe(0);
  });
  test("no tenant or store fallback",()=>{
    code(()=>planMixedCheckoutQuote({...base(),merchantRules:[{...rate,organizationId:"someone_else"}]}),"SHIPPING_NOT_QUOTED");
    code(()=>planMixedCheckoutQuote({...base(),merchantRules:[{...rate,storeId:"someone_else"}]}),"SHIPPING_NOT_QUOTED");
  });
  test("never invents rate for unsupported country or currency",()=>{
    code(()=>planMixedCheckoutQuote({...base(),destination:{country:"CA",region:"ON"}}),"SHIPPING_NOT_QUOTED");
    code(()=>planMixedCheckoutQuote({...base(),merchantRules:[{...rate,currency:"CAD"}]}),"SHIPPING_NOT_QUOTED");
  });
  test("region-specific rule overrides countrywide rule",()=>{
    const quote=planMixedCheckoutQuote({...base(),merchantRules:[rate,{...rate,methodId:"illinois",region:"IL",amountMinor:1000}]});
    expect(quote.shippingMinor).toBe(1000);
  });
  test("ambiguous same-zone rates fail closed",()=>{
    code(()=>planMixedCheckoutQuote({...base(),merchantRules:[rate,{...rate,methodId:"other"}]}),"SHIPPING_NOT_QUOTED");
  });
  test("inactive rule is not eligible",()=>{
    code(()=>planMixedCheckoutQuote({...base(),merchantRules:[{...rate,enabled:false}]}),"SHIPPING_NOT_QUOTED");
  });
  test("explicit free shipping requires no tax on shipping",()=>{
    const quote=planMixedCheckoutQuote({...base(),merchantRules:[{...rate,amountMinor:0}],shippingTaxCode:undefined});
    expect(quote.shippingMinor).toBe(0);
    expect(quote.shippingCost).toBeNull();
  });
  test("missing physical address is rejected",()=>{
    code(()=>planMixedCheckoutQuote({...base(),destination:undefined}),"SHIPPING_ADDRESS_REQUIRED");
  });
  test("missing or repeated tax category fails closed",()=>{
    code(()=>planMixedCheckoutQuote({...base(),variantTaxCodes:[taxes[1]!]}),"TAX_CLASSIFICATION_REQUIRED");
    code(()=>planMixedCheckoutQuote({...base(),variantTaxCodes:[...taxes,taxes[0]!]}),"TAX_CLASSIFICATION_INVALID");
    code(()=>planMixedCheckoutQuote({...base(),variantTaxCodes:[...taxes,{variantId:"alien",taxCode:"txcd_20030000"}]}),"TAX_CLASSIFICATION_INVALID");
  });
  test("requires tax code for paid shipping",()=>{
    code(()=>planMixedCheckoutQuote({...base(),shippingTaxCode:undefined}),"SHIPPING_TAX_CODE_REQUIRED");
  });
  test("rejects duplicate editions, fractional quantities, and mismatched currencies",()=>{
    code(()=>planMixedCheckoutQuote({...base(),lines:[physical,physical]}),"CHECKOUT_QUOTE_INVALID");
    code(()=>planMixedCheckoutQuote({...base(),lines:[{...physical,quantity:1.5},digital]}),"CHECKOUT_QUOTE_INVALID");
    code(()=>planMixedCheckoutQuote({...base(),lines:[{...physical,currency:"CAD"},digital]}),"CHECKOUT_QUOTE_INVALID");
  });
  test("protects monetary DB bounds",()=>{
    code(()=>planMixedCheckoutQuote({...base(),lines:[{...physical,unitPriceMinor:2147483647},digital]}),"CHECKOUT_QUOTE_INVALID");
    code(()=>planMixedCheckoutQuote({...base(),merchantRules:[{...rate,amountMinor:-1}]}),"SHIPPING_CONFIGURATION_INVALID");
  });
  const provider = {id:"taxcalc_123456789",livemode:false,currency:"usd",amount_total:7075,
    tax_amount_exclusive:425,tax_amount_inclusive:0,shipping_cost:{amount:650},expires_at:Date.parse("2026-11-05T12:04:00Z")/1000};
  const calculated = () => ({organizationId:org,storeId:store,currency:"USD",fingerprint:"a".repeat(64),
    subtotalMinor:6000,shippingMinor:650,stripeCalculation:provider,now:new Date("2026-11-05T12:00:00Z")});
  test("Stripe provider totals reconcile to actual cart + shipping + tax",()=>{
    const verified=verifyMixedStripeTaxQuote(calculated());
    expect(verified.taxMinor).toBe(425);
    expect(verified.shippingMinor).toBe(650);
    expect(verified.validUntil.toISOString()).toBe("2026-11-05T12:04:00.000Z");
  });
  test("rejects live, absent, inconsistent and expired Stripe tax calculations",()=>{
    code(()=>verifyMixedStripeTaxQuote({...calculated(),stripeCalculation:{...provider,livemode:true}}),"TAX_QUOTE_INVALID");
    code(()=>verifyMixedStripeTaxQuote({...calculated(),stripeCalculation:{...provider,shipping_cost:{amount:600}}}),"TAX_QUOTE_INVALID");
    code(()=>verifyMixedStripeTaxQuote({...calculated(),stripeCalculation:{...provider,amount_total:6000}}),"TAX_QUOTE_INVALID");
    code(()=>verifyMixedStripeTaxQuote({...calculated(),stripeCalculation:{...provider,expires_at:Date.parse("2026-11-05T11:59:00Z")/1000}}),"TAX_QUOTE_EXPIRED");
  });
});
