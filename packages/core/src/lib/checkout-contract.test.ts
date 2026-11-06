import { checkoutPreflightInput, evaluateCheckoutPreflight } from "./checkout-contract";
import { quoteLines, type SellableVariant } from "./cart-contract";
function variant(fulfillment:"DIGITAL"|"PHYSICAL"): SellableVariant {
  return {
    id:"variant_001", name:"Edition", fulfillment, inventoryPolicy:"UNLIMITED",
    priceMinor:2500, currency:"USD", active:true, inventory:[],
    digitalFiles:[{id:"private_file"}],
    product:{id:"product_001",title:"Original artwork",status:"PUBLISHED",listings:[{status:"PUBLISHED"}]},
  };
}
const address={recipient:"Customer",line1:"100 Main Street",city:"Town",region:"IL",postalCode:"60601",country:"US"};
test("buyer input rejects amounts, payment accounts, and state changes",()=>{
  expect(checkoutPreflightInput.safeParse({email:"buyer@example.com",amountMinor:0}).success).toBe(false);
  expect(checkoutPreflightInput.safeParse({email:"buyer@example.com",providerAccount:"acct_fake"}).success).toBe(false);
  expect(checkoutPreflightInput.safeParse({email:"buyer@example.com",shippingAddress:{...address,organizationId:"org_foreign"}}).success).toBe(false);
});
test("digital purchase does not require shipping, but still cannot charge",()=>{
  const result=evaluateCheckoutPreflight(quoteLines([{quantity:1,variant:variant("DIGITAL")}]),{email:"buyer@example.com"});
  expect(result.shippingAddressRequired).toBe(false);
  expect(result.blockers).not.toContain("SHIPPING_ADDRESS_REQUIRED");
  expect(result.blockers).toContain("TAX_NOT_QUOTED");
  expect(result.checkoutEnabled).toBe(false);
});
test("mixed cart requires shipping and never assumes zero tax or shipping",()=>{
  const digital=variant("DIGITAL");digital.id="digital_001";
  const physical=variant("PHYSICAL");physical.id="physical_001";
  const quote=quoteLines([{quantity:1,variant:digital},{quantity:2,variant:physical}]);
  const result=evaluateCheckoutPreflight(quote,{email:"buyer@example.com"});
  expect(result).toMatchObject({subtotalMinor:7500,itemCount:3,fulfillment:{physical:true,digital:true}});
  expect(result.blockers).toEqual(expect.arrayContaining(["SHIPPING_ADDRESS_REQUIRED","SHIPPING_NOT_QUOTED","INVENTORY_NOT_RESERVED"]));
  expect(result.checkoutEnabled).toBe(false);
});
test("providing shipping address does not bypass payment/tax checks",()=>{
  const quote=quoteLines([{quantity:1,variant:variant("PHYSICAL")}]);
  const contact=checkoutPreflightInput.parse({email:"buyer@example.com",shippingAddress:address});
  const result=evaluateCheckoutPreflight(quote,contact);
  expect(result.blockers).not.toContain("SHIPPING_ADDRESS_REQUIRED");
  expect(result.blockers).toContain("PAYMENT_CONNECTION_NOT_VERIFIED");
  expect(result.checkoutEnabled).toBe(false);
  expect(JSON.stringify(result)).not.toContain("buyer@example.com");
  expect(JSON.stringify(result)).not.toContain("Main Street");
});
test("an empty cart has blockers, never silently creates free checkout",()=>{
  const result=evaluateCheckoutPreflight(quoteLines([]));
  expect(result.blockers).toContain("EMPTY_CART");
  expect(result.checkoutEnabled).toBe(false);
});
test("unavailable digital asset blocks checkout",()=>{
  const v=variant("DIGITAL");v.digitalFiles=[];
  const result=evaluateCheckoutPreflight(quoteLines([{quantity:1,variant:v}]),{email:"buyer@example.com"});
  expect(result.blockers).toContain("CART_HAS_ISSUES");
});
