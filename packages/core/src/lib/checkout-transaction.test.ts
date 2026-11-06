import { prisma } from "@acme/core/lib/prisma";
import { checkoutQuoteFingerprint, prepareCheckoutAttempt, expireUnsubmittedCheckout } from "./checkout-transaction";

jest.mock("@acme/core/lib/prisma", () => ({prisma: {$transaction: jest.fn()}}));
const db = prisma as unknown as {$transaction: jest.Mock};
const org = "org_001", store = "store_001", cartId = "cart_001", connId = "conn_001";
const guestCartToken = "q".repeat(43);
const contact = {email:"buyer@example.com", shippingAddress: {
  recipient:"Buyer",line1:"Main St 1",city:"Chicago",postalCode:"60601",country:"US",
}};
const connection = {id:connId, organizationId:org, status:"VERIFIED", verifiedAt:new Date("2026-11-02T00:00:00Z"),
  provider:"stripe",accountRef:"acct_test_1",secretRef:"secret/test",capabilities:["payments"]};
const product = {title:"Sticker",status:"PUBLISHED",listings:[{organizationId:org,storeId:store,status:"PUBLISHED"}]};
function line(args:{physical?:boolean;quantity?:number}={}) {
  return {quantity:args.quantity ?? 2,variant: {
    id:"variant_001",name:"A4",sku:"SKU_01",attributes:{finish:"matte"},
    fulfillment:args.physical?"PHYSICAL":"DIGITAL",inventoryPolicy:args.physical?"TRACKED":"UNLIMITED",
    active:true,priceMinor:399,currency:"USD",
    inventory:args.physical?[{locationId:"loc_a",onHand:3,reserved:1},{locationId:"loc_b",onHand:4,reserved:0}]:[],
    digitalFiles:args.physical?[]:[{id:"file_001"}],product,
  }};
}
function quote(lines:ReturnType<typeof line>[],args:{tax?:number;shipping?:number;address?:typeof contact.shippingAddress}={}) {
  return {organizationId:org,storeId:store,reference:"server_quote_001",currency:"USD",
    cartFingerprint:checkoutQuoteFingerprint({organizationId:org,storeId:store,cartId,currency:"USD",
      shippingAddress:args.address ?? contact.shippingAddress,
      lines:lines.map(l => ({variantId:l.variant.id,quantity:l.quantity,priceMinor:l.variant.priceMinor,currency:l.variant.currency}))}),
    taxMinor:args.tax ?? 0,shippingMinor:args.shipping ?? 0,
    validUntil:new Date(Date.now()+5*60*1000)};
}
function makeTx(lines:ReturnType<typeof line>[]) {
  return {
    storefront:{findFirst:jest.fn().mockResolvedValue({id:store,organizationId:org})},
    integrationConnection:{findFirst:jest.fn().mockResolvedValue(connection)},
    cart:{findFirst:jest.fn().mockResolvedValue({id:cartId,items:lines})},
    checkoutAttempt:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({id:"attempt_001"}),
      findFirst:jest.fn().mockResolvedValue(null),updateMany:jest.fn().mockResolvedValue({count:1})},
    customer:{upsert:jest.fn().mockResolvedValue({id:"customer_001"})},
    order:{create:jest.fn().mockResolvedValue({id:"order_001"}),findFirst:jest.fn().mockResolvedValue({id:"order_001"}),
      updateMany:jest.fn().mockResolvedValue({count:1})},
    orderItem:{create:jest.fn().mockResolvedValue({id:"item_001"})},
    orderDigitalFile:{create:jest.fn().mockResolvedValue({})},
    inventoryLevel:{updateMany:jest.fn().mockResolvedValue({count:1})},
    stockHold:{create:jest.fn().mockResolvedValue({id:"hold_001"}),
      findMany:jest.fn().mockResolvedValue([]),updateMany:jest.fn().mockResolvedValue({count:1})},
  };
}
function wire<T>(tx:T) {db.$transaction.mockImplementation((fn:(tx:T)=>unknown)=>fn(tx));}
beforeEach(()=>{jest.clearAllMocks();});
test("prepares digital unpaid order from DB price without a stock hold or provider charge",async()=>{
  const lines=[line()];const tx=makeTx(lines);wire(tx);
  const result=await prepareCheckoutAttempt({storeId:store,guestCartToken,contact,
    idempotencyKey:"a".repeat(32),paymentConnectionId:connId,trustedQuote:quote(lines)});
  expect(result).toMatchObject({status:"PREPARED",replay:false,subtotalMinor:798,totalMinor:798});
  expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({
    organizationId:org,storeId:store,status:"PENDING",totalMinor:798,
  })}));
  expect(tx.stockHold.create).not.toHaveBeenCalled();
  expect(tx.orderDigitalFile.create).toHaveBeenCalledWith({data:{
    organizationId:org,orderItemId:"item_001",digitalFileId:"file_001",
  }});
  expect(tx.checkoutAttempt.create).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toMatch(/acct_test|secret\/test|buyer@example.com/);
});
test("creates tracked multi-location holds, incrementing reserved with CAS",async()=>{
  const lines=[line({physical:true,quantity:4})];const tx=makeTx(lines);wire(tx);
  const result=await prepareCheckoutAttempt({storeId:store,guestCartToken,contact,
    idempotencyKey:"b".repeat(32),paymentConnectionId:connId,
    trustedQuote:quote(lines,{shipping:100,tax:50})});
  expect(result.totalMinor).toBe(1746);
  expect(tx.inventoryLevel.updateMany).toHaveBeenCalledTimes(2);
  expect(tx.inventoryLevel.updateMany).toHaveBeenNthCalledWith(1,{where: {
    organizationId:org,variantId:"variant_001",locationId:"loc_a",reserved:1,onHand:{gte:3}},
    data:{reserved:{increment:2}},
  });
  expect(tx.orderDigitalFile.create).not.toHaveBeenCalled();
  expect(tx.stockHold.create).toHaveBeenCalledTimes(2);
  expect(tx.stockHold.create).toHaveBeenNthCalledWith(2,{data:expect.objectContaining({
    organizationId:org,variantId:"variant_001",locationId:"loc_b",quantity:2,status:"HELD",
  })});
});
test("rejects another merchant payment connection before any order write",async()=>{
  const lines=[line()];const tx=makeTx(lines);tx.integrationConnection.findFirst.mockResolvedValue(null);wire(tx);
  await expect(prepareCheckoutAttempt({storeId:store,guestCartToken,contact,idempotencyKey:"c".repeat(32),
    paymentConnectionId:connId,trustedQuote:quote(lines)})).rejects.toThrow("Merchant payment connection");
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.integrationConnection.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:connId,organizationId:org}}));
});
test("stale or mismatched trusted quote rejects before order creation",async()=>{
  const lines=[line()];const tx=makeTx(lines);wire(tx);
  await expect(prepareCheckoutAttempt({storeId:store,guestCartToken,contact,idempotencyKey:"d".repeat(32),
    paymentConnectionId:connId,trustedQuote:{...quote(lines),cartFingerprint:"changed"}})).rejects.toThrow("server-verified");
  expect(tx.order.create).not.toHaveBeenCalled();
});
test("idempotent replay uses existing order and does not double-reserve",async()=>{
  const lines=[line({physical:true})];const tx=makeTx(lines);wire(tx);
  const args={storeId:store,guestCartToken,contact,idempotencyKey:"e".repeat(32),
    paymentConnectionId:connId,trustedQuote:quote(lines)};
  const first=await prepareCheckoutAttempt(args);
  const prepared=tx.checkoutAttempt.create.mock.calls[0][0].data;
  tx.checkoutAttempt.findUnique.mockResolvedValue({id:"attempt_001",orderId:"order_001",status:"PREPARED",
    expiresAt:new Date(Date.now()+10*60*1000),organizationId:org,storeId:store,
    requestFingerprint:prepared.requestFingerprint});
  const replay=await prepareCheckoutAttempt(args);
  expect(replay).toMatchObject({attemptId:first.attemptId,orderId:first.orderId,replay:true});
  expect(tx.order.create).toHaveBeenCalledTimes(1);
  expect(tx.stockHold.create).toHaveBeenCalledTimes(1);
});
test("reused key for changed checkout is a conflict",async()=>{
  const lines=[line()];const tx=makeTx(lines);wire(tx);
  tx.checkoutAttempt.findUnique.mockResolvedValue({id:"attempt_001",orderId:"order_001",status:"PREPARED",
    expiresAt:new Date(Date.now()+10*60*1000),organizationId:org,storeId:store,requestFingerprint:"other"});
  await expect(prepareCheckoutAttempt({storeId:store,guestCartToken,contact,idempotencyKey:"f".repeat(32),
    paymentConnectionId:connId,trustedQuote:quote(lines)})).rejects.toThrow("different checkout");
  expect(tx.order.create).not.toHaveBeenCalled();
});
test("expires only unsubmitted, pending attempts, releasing tracked inventory atomically",async()=>{
  const tx=makeTx([]);wire(tx);
  tx.checkoutAttempt.findFirst.mockResolvedValue({id:"attempt_001",orderId:"order_001"});
  tx.stockHold.findMany.mockResolvedValue([{id:"hold_001",variantId:"variant_001",locationId:"loc_a",quantity:2}]);
  const result=await expireUnsubmittedCheckout({organizationId:org,storeId:store,attemptId:"attempt_001"});
  expect(result).toEqual({released:true,holdsReleased:1});
  expect(tx.inventoryLevel.updateMany).toHaveBeenCalledWith({where:{organizationId:org,variantId:"variant_001",
    locationId:"loc_a",reserved:{gte:2}},data:{reserved:{decrement:2}}});
  expect(tx.checkoutAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({
    status:"PREPARED",providerSessionId:null,
  })}));
  expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"CANCELLED"}}));
});
test("does not release if no safe unsubmitted attempt matches",async()=>{
  const tx=makeTx([]);wire(tx);
  const result=await expireUnsubmittedCheckout({organizationId:org,storeId:store,attemptId:"attempt_001"});
  expect(result).toEqual({released:false,holdsReleased:0});
  expect(tx.stockHold.updateMany).not.toHaveBeenCalled();
});
test("failed stock CAS aborts the serializable transaction",async()=>{
  const lines=[line({physical:true})];const tx=makeTx(lines);wire(tx);
  tx.inventoryLevel.updateMany.mockResolvedValue({count:0});
  await expect(prepareCheckoutAttempt({storeId:store,guestCartToken,contact,idempotencyKey:"g".repeat(32),
    paymentConnectionId:connId,trustedQuote:quote(lines)})).rejects.toThrow("Concurrent stock update");
  expect(tx.checkoutAttempt.create).not.toHaveBeenCalled();
});
test("mixed physical and digital checkout snapshots both items but holds only tracked physical stock",async()=>{
  const physical=line({physical:true,quantity:1});
  const digital=line({quantity:2});digital.variant.id="variant_002";
  const lines=[physical,digital];const tx=makeTx(lines);wire(tx);
  const result=await prepareCheckoutAttempt({storeId:store,guestCartToken,contact,
    idempotencyKey:"h".repeat(32),paymentConnectionId:connId,
    trustedQuote:quote(lines,{shipping:120,tax:100})});
  expect(result.totalMinor).toBe(1417);
  expect(tx.orderItem.create).toHaveBeenCalledTimes(2);
  expect(tx.stockHold.create).toHaveBeenCalledTimes(1);
});
test("identical replay remains resumable after quote expiry, before checkout attempt expiry",async()=>{
  const lines=[line()];const tx=makeTx(lines);wire(tx);
  const args={storeId:store,guestCartToken,contact,idempotencyKey:"i".repeat(32),
    paymentConnectionId:connId,trustedQuote:quote(lines)};
  await prepareCheckoutAttempt(args);
  const prepared=tx.checkoutAttempt.create.mock.calls[0][0].data;
  tx.checkoutAttempt.findUnique.mockResolvedValue({id:"attempt_001",orderId:"order_001",status:"PREPARED",
    expiresAt:new Date(Date.now()+10*60*1000),organizationId:org,storeId:store,
    requestFingerprint:prepared.requestFingerprint});
  const result=await prepareCheckoutAttempt({...args,trustedQuote:{...args.trustedQuote,validUntil:new Date(Date.now()-1000)}});
  expect(result.replay).toBe(true);
  expect(tx.order.create).toHaveBeenCalledTimes(1);
});

test("digital file snapshot is not created on checkout replay",async()=>{
  const lines=[line()];const tx=makeTx(lines);wire(tx);
  const args={storeId:store,guestCartToken,contact,idempotencyKey:"j".repeat(32),
    paymentConnectionId:connId,trustedQuote:quote(lines)};
  await prepareCheckoutAttempt(args);
  const prepared=tx.checkoutAttempt.create.mock.calls[0][0].data;
  tx.checkoutAttempt.findUnique.mockResolvedValue({id:"attempt_001",orderId:"order_001",status:"PREPARED",
    expiresAt:new Date(Date.now()+10*60*1000),organizationId:org,storeId:store,
    requestFingerprint:prepared.requestFingerprint});
  expect((await prepareCheckoutAttempt(args)).replay).toBe(true);
  expect(tx.orderDigitalFile.create).toHaveBeenCalledTimes(1);
});
