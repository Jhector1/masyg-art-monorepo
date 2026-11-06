import {
  CommerceInvariantError, planPhysicalStock, calculateTrustedOrderTotal,
  assertPaymentConnection, hashIdempotencyKey, checkoutFingerprint, assertAttemptReplay,
} from "./commerce-invariants";
const conn = {id:"conn_001",organizationId:"org_001",status:"VERIFIED" as const,
  verifiedAt:new Date("2026-11-02T00:00:00Z"),provider:"stripe",accountRef:"acct_test_001",secretRef:"secrets/acct1",capabilities:["payments"]};
test("tracked stock uses available units only and makes stable location allocations",()=>{
  expect(planPhysicalStock(5,[
    {locationId:"loc_b",onHand:5,reserved:2}, {locationId:"loc_a",onHand:4,reserved:2},
  ])).toEqual([{locationId:"loc_a",quantity:2},{locationId:"loc_b",quantity:3}]);
});
test("sold out reservations fail instead of overselling",()=>{
  expect(()=>planPhysicalStock(4,[{locationId:"loc_1",onHand:5,reserved:2}])).toThrow("Insufficient");
});
test("rejects duplicate locations and corrupt inventory",()=>{
  expect(()=>planPhysicalStock(2,[{locationId:"loc_1",onHand:1,reserved:0},{locationId:"loc_1",onHand:1,reserved:0}])).toThrow();
  expect(()=>planPhysicalStock(1,[{locationId:"loc_1",onHand:1,reserved:2}])).toThrow();
});
test("payment totals use only server supplied integer minor units",()=>{
  expect(calculateTrustedOrderTotal({currency:"USD",lines:[{quantity:2,unitPriceMinor:499,currency:"USD"}],taxMinor:85,shippingMinor:125,includesPhysical:true})).toMatchObject({subtotalMinor:998,totalMinor:1208});
});
test("mixed currencies and fractional money fail",()=>{
  expect(()=>calculateTrustedOrderTotal({currency:"USD",lines:[{quantity:1,unitPriceMinor:10.5,currency:"USD"}],taxMinor:0,shippingMinor:0,includesPhysical:false})).toThrow();
  expect(()=>calculateTrustedOrderTotal({currency:"USD",lines:[{quantity:1,unitPriceMinor:100,currency:"EUR"}],taxMinor:0,shippingMinor:0,includesPhysical:false})).toThrow();
});
test("digital-only orders reject physical shipping amounts",()=>{
  expect(()=>calculateTrustedOrderTotal({currency:"USD",lines:[{quantity:1,unitPriceMinor:100,currency:"USD"}],taxMinor:0,shippingMinor:2,includesPhysical:false})).toThrow();
});
test("checkout amount overflow is rejected",()=>{
  expect(()=>calculateTrustedOrderTotal({currency:"USD",lines:[{quantity:20,unitPriceMinor:2_147_483_647,currency:"USD"}],taxMinor:0,shippingMinor:0,includesPhysical:false})).toThrow();
});
test("payment connection must be verified and match the organization",()=>{
  expect(()=>assertPaymentConnection("org_001",conn)).not.toThrow();
  expect(()=>assertPaymentConnection("org_foreign",conn)).toThrow();
  expect(()=>assertPaymentConnection("org_001",{...conn,status:"PENDING"})).toThrow();
  expect(()=>assertPaymentConnection("org_001",{...conn,capabilities:["catalog"]})).toThrow();
  expect(()=>assertPaymentConnection("org_001",{...conn,verifiedAt:null})).toThrow();
});
test("idempotency keys are validated and SHA-256 hashed",()=>{
  const key="a".repeat(32);
  expect(hashIdempotencyKey(key)).toMatch(/^[a-f0-9]{64}$/);
  expect(hashIdempotencyKey(key)).not.toEqual(key);
  expect(()=>hashIdempotencyKey("short")).toThrow();
});
test("fingerprints do not depend on object key order",()=>{
  const a=checkoutFingerprint({storeId:"store_001",items:[{id:"v1",qty:1}],tax:0});
  const b=checkoutFingerprint({tax:0,items:[{qty:1,id:"v1"}],storeId:"store_001"});
  expect(a).toEqual(b);
  expect(a).toMatch(/^[a-f0-9]{64}$/);
  expect(()=>checkoutFingerprint({nan:NaN})).toThrow();
});
test("idempotent replay accepts same facts but rejects changed buyer/store",()=>{
  const existing={organizationId:"org_001",storeId:"store_001",requestFingerprint:"fp1",status:"PREPARED"};
  expect(()=>assertAttemptReplay(existing,{organizationId:"org_001",storeId:"store_001",requestFingerprint:"fp1"})).not.toThrow();
  expect(()=>assertAttemptReplay(existing,{organizationId:"org_001",storeId:"store_002",requestFingerprint:"fp1"})).toThrow();
  expect(()=>assertAttemptReplay(existing,{organizationId:"org_001",storeId:"store_001",requestFingerprint:"fp2"})).toThrow();
  expect(()=>assertAttemptReplay({...existing,status:"EXPIRED"},{organizationId:"org_001",storeId:"store_001",requestFingerprint:"fp1"})).toThrow();
});
