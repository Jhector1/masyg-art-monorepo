import { stripeTestCheckoutInput, digitalTaxCode, trustedDigitalQuote, contactForCheckout } from "./stripe-test-checkout-input";
const billingAddress={recipient:"A Customer",line1:"12 Example St",city:"Austin",region:"TX",postalCode:"78701",country:"US"};
test("buyer cannot submit server-owned purchase facts",()=>{
  const ok={idempotencyKey:"test_checkout_0123456789abcde",billingAddress};
  expect(stripeTestCheckoutInput.parse(ok)).toEqual(ok);
  for(const key of ["amountMinor","orderId","organizationId","userId","taxMinor","providerAccount","paymentStatus"])
    expect(stripeTestCheckoutInput.safeParse({...ok,[key]:"forged"}).success).toBe(false);
  expect(stripeTestCheckoutInput.safeParse({...ok,idempotencyKey:"short"}).success).toBe(false);
});
test("tax class must be explicitly merchant-configured",()=>{
  expect(digitalTaxCode(["payments","tax-code:txcd_12345678"])).toBe("txcd_12345678");
  expect(()=>digitalTaxCode(["payments"])).toThrow("classification");
  expect(()=>digitalTaxCode(["payments","tax-code:txcd_12345678","tax-code:txcd_22222222"])).toThrow();
});
test("Stripe tax quote must match cart subtotal, be finite, current and zero shipping",()=>{
  const now=new Date("2026-11-03T12:00:00Z");
  const args={organizationId:"org_001",storeId:"store_001",currency:"USD",
    cartFingerprint:"a".repeat(64),taxId:"taxcalc_123456",taxMinor:80,subtotalMinor:1000,
    amountTotal:1080,shippingMinor:0,now};
  expect(trustedDigitalQuote(args).taxMinor).toBe(80);
  expect(()=>trustedDigitalQuote({...args,amountTotal:1000})).toThrow();
  expect(()=>trustedDigitalQuote({...args,shippingMinor:1})).toThrow();
  expect(()=>trustedDigitalQuote({...args,calculationExpiresAt:Math.floor(now.getTime()/1000)})).toThrow();
});
test("contact uses canonical validation, not browser totals",()=>{
  expect(contactForCheckout("a@example.com",billingAddress).email).toBe("a@example.com");
  expect(()=>contactForCheckout("a@example.com",{...billingAddress, country:"???"})).toThrow();
});
