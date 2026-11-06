jest.mock("@acme/core/lib/prisma",()=>({
  prisma:{storefront:{findFirst:jest.fn()},checkoutAttempt:{findFirst:jest.fn()}},
}));
import { prisma } from "@acme/core/lib/prisma";
import { getBuyerCheckoutSession, requireProviderSessionId } from "./customer-checkout-session";
const db=prisma as jest.Mocked<typeof prisma>;
beforeEach(()=>jest.clearAllMocks());
const sessionId="cs_test_0123456789";
test("rejects anonymous callers before touching Prisma",async()=>{
  await expect(getBuyerCheckoutSession({userId:null,storeId:"store_01",sessionId})).rejects.toMatchObject({status:401});
  expect(db.storefront.findFirst).not.toHaveBeenCalled();
});
test("rejects malformed provider session IDs before database lookup",async()=>{
  expect(()=>requireProviderSessionId("https://example.org/?foo=1")).toThrow();
  await expect(getBuyerCheckoutSession({userId:"buyer_01",storeId:"store_01",sessionId:"<script>"})).rejects.toMatchObject({status:400});
  expect(db.storefront.findFirst).not.toHaveBeenCalled();
});
test("never looks up another store's session or unverified buyer",async()=>{
  (db.storefront.findFirst as jest.Mock).mockResolvedValue({organizationId:"org_01"});
  (db.checkoutAttempt.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(getBuyerCheckoutSession({userId:"buyer_01",storeId:"store_01",sessionId})).rejects.toMatchObject({status:404});
  expect(db.checkoutAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where:{organizationId:"org_01",storeId:"store_01",providerSessionId:sessionId,
      order:{customer:{is:{userId:"buyer_01"}}}},
    select:expect.objectContaining({order:expect.anything()}),
  }));
});
test("a pending provider redirect remains PENDING and cannot issue downloads",async()=>{
  (db.storefront.findFirst as jest.Mock).mockResolvedValue({organizationId:"org_01"});
  (db.checkoutAttempt.findFirst as jest.Mock).mockResolvedValue({order:{
    id:"order_01",status:"PENDING",currency:"USD",totalMinor:1300,
    createdAt:new Date("2026-11-03T00:00:00Z"),
    shippingAddress:{street:"A",city:"B",state:"C",postalCode:"123",country:"US",privateNote:"never"},
    items:[{id:"line_01",titleSnapshot:"Painting",fulfillment:"PHYSICAL",quantity:1,totalMinor:1300}],
  }});
  const result=await getBuyerCheckoutSession({userId:"buyer_01",storeId:"store_01",sessionId});
  expect(result).toMatchObject({status:"PENDING",processing:true,totalMinor:1300});
  expect(JSON.stringify(result)).not.toContain("privateNote");
  expect(JSON.stringify(result)).not.toMatch(/tokenHash|storageKey|downloadUrl|providerPaymentId/);
});
