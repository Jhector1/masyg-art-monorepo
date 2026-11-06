import { formatMinorMoney, isCartCheckoutAvailable } from "./cart-view";
import type { CartQuote } from "./storefront-commerce";

const quote: CartQuote = {
  items: [{variantId:"variant_123", productId:"product_123", title:"Art", variantName:"Print",
    fulfillment:"PHYSICAL", quantity:2, unitPriceMinor:1250, lineMinor:2500,
    currency:"USD", available:true}],
  currency:"USD", subtotalMinor:2500, issues:[],readyForCheckout:false,
  note:"Quote only",
};

test("money formats server minor units with currency-specific precision",()=>{
  expect(formatMinorMoney(12345,"USD")).toBe("$123.45");
  expect(formatMinorMoney(12345,"JPY")).toBe("¥12,345");
  expect(formatMinorMoney(12345,"KWD")).toContain("12.345");
});
test("malformed money values are refused instead of rendered",()=>{
  expect(()=>formatMinorMoney(1.5,"USD")).toThrow("Invalid server cart quote");
  expect(()=>formatMinorMoney(100,"usd")).toThrow("Invalid server cart quote");
});
test("a non-chargeable cart quote can never enable checkout",()=>{
  expect(isCartCheckoutAvailable(quote)).toBe(false);
  expect(isCartCheckoutAvailable(null)).toBe(false);
  expect(isCartCheckoutAvailable({...quote,items:[]})).toBe(false);
});
