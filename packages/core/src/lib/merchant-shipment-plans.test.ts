jest.mock("@acme/core/lib/prisma", () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock("./tenancy", () => ({
  requireMerchantAccess:jest.fn(),validateTenantId:(x:string)=>x,
  TenantAccessError:class TenantAccessError extends Error {status=404;},
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { planMerchantShipment } from "./merchant-shipment-plans";
import { createHash } from "node:crypto";
const input={clientRequestId:"11111111-1111-4111-8111-111111111111",items:[{orderItemId:"item_1",quantity:2}]};
const args={userId:"owner_1",organizationId:"org_1",storeId:"store_1",orderId:"order_1",body:input};
function tx(){return {organizationMember:{findUnique:jest.fn().mockResolvedValue({role:"OWNER"})},
  shipment:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({id:"shipment_1",status:"PENDING"})},
  shipmentItem:{createMany:jest.fn()},
  order:{findFirst:jest.fn().mockResolvedValue({id:"order_1",status:"PAID",items:[{id:"item_1",quantity:2,fulfillment:"PHYSICAL"}],shipments:[]})},
  merchantAuditLog:{create:jest.fn()}};}
beforeEach(()=>{jest.clearAllMocks();(requireMerchantAccess as jest.Mock).mockResolvedValue({organizationId:"org_1",storeId:"store_1",role:"OWNER"});});
it("rejects duplicate order items",async()=>{
  await expect(planMerchantShipment({...args,body:{...input,items:[input.items[0],input.items[0]]}})).rejects.toThrow(/Duplicate/);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
it("does not allow planning an unpaid order",async()=>{
  const mock=tx();mock.order.findFirst.mockResolvedValue({id:"order_1",status:"PENDING",items:[],shipments:[]});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(mock));
  await expect(planMerchantShipment(args)).rejects.toThrow(/Only paid/);
  expect(mock.shipment.create).not.toHaveBeenCalled();
});
it("cannot overplan previously allocated quantities",async()=>{
  const mock=tx();mock.order.findFirst.mockResolvedValue({id:"order_1",status:"PAID",items:[{id:"item_1",quantity:2,fulfillment:"PHYSICAL"}],shipments:[{items:[{orderItemId:"item_1",quantity:1}]}]});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(mock));
  await expect(planMerchantShipment(args)).rejects.toThrow(/exceeds/);
  expect(mock.shipment.create).not.toHaveBeenCalled();
});
it("creates a pending plan and audit without mutating payment/order/inventory",async()=>{
  const mock=tx();(prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(mock));
  await expect(planMerchantShipment(args)).resolves.toEqual({id:"shipment_1",status:"PENDING",reused:false});
  expect(mock.shipment.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"PENDING",organizationId:"org_1",storeId:"store_1"})}));
  expect(mock.shipmentItem.createMany).toHaveBeenCalledTimes(1);
  expect(mock.merchantAuditLog.create).toHaveBeenCalledTimes(1);
});
it("repeated client request returns the same shipment without creating another",async()=>{
  const mock=tx();const planFingerprint=createHash("sha256").update(JSON.stringify({carrier:"",trackingNumber:"",items:input.items})).digest("hex");
  mock.shipment.findUnique.mockResolvedValue({id:"shipment_1",status:"PENDING",planFingerprint});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(mock));
  await expect(planMerchantShipment(args)).resolves.toEqual({id:"shipment_1",status:"PENDING",reused:true});
  expect(mock.shipment.create).not.toHaveBeenCalled();
});
it("rechecks roles in the transaction",async()=>{
  const mock=tx();mock.organizationMember.findUnique.mockResolvedValue({role:"MEMBER"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(mock));
  await expect(planMerchantShipment(args)).rejects.toMatchObject({status:404});
});

it("rejects reusing the same request key with altered items",async()=>{
  const mock=tx();mock.shipment.findUnique.mockResolvedValue({id:"shipment_1",status:"PENDING",planFingerprint:"wrong"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(mock));
  await expect(planMerchantShipment(args)).rejects.toThrow(/reused with different/);
  expect(mock.shipment.create).not.toHaveBeenCalled();
});
