import {prisma} from "@acme/core/lib/prisma";
import {closeVerifiedExpiredCheckout,closeVerifiedAsyncFailedCheckout} from "./stripe-closed-ledger";
jest.mock("@acme/core/lib/prisma",()=>({prisma:{$transaction:jest.fn()}}));
const db=prisma as unknown as {$transaction:jest.Mock};
const evidence={provider:"stripe" as const,eventId:"evt_12345678",providerAccount:"acct_1234567",
  sessionId:"cs_test_12345",attemptId:"attempt_001",orderId:"order_001",amountMinor:1200,currency:"USD"};
const item={id:"line_001",variantId:"variant_001",fulfillment:"PHYSICAL",quantity:2,
  variant:{inventoryPolicy:"TRACKED"}};
const attempt={id:evidence.attemptId,organizationId:"org_001",storeId:"store_001",orderId:evidence.orderId,
  connectionId:"conn_001",providerSessionId:evidence.sessionId,status:"SESSION_CREATED",
  connection:{id:"conn_001",organizationId:"org_001",provider:"stripe",accountRef:evidence.providerAccount,
    status:"VERIFIED",verifiedAt:new Date(),capabilities:["payments"]},
  order:{id:evidence.orderId,organizationId:"org_001",storeId:"store_001",status:"PENDING",
    totalMinor:1200,currency:"USD",items:[item]}};
const hold={id:"hold_001",orderItemId:item.id,variantId:item.variantId,locationId:"loc_001",quantity:2,status:"HELD"};
function makeTx(args:{attempt?:any;holds?:any[];event?:any}={}){
  return {
    providerEvent:{findUnique:jest.fn().mockResolvedValue(args.event??null),create:jest.fn().mockResolvedValue({id:"evt_db"})},
    checkoutAttempt:{findFirst:jest.fn().mockResolvedValue(args.attempt??attempt),updateMany:jest.fn().mockResolvedValue({count:1})},
    stockHold:{findMany:jest.fn().mockResolvedValue(args.holds??[hold]),updateMany:jest.fn().mockResolvedValue({count:1})},
    inventoryLevel:{updateMany:jest.fn().mockResolvedValue({count:1})},
    order:{updateMany:jest.fn().mockResolvedValue({count:1})},
    payment:{create:jest.fn()},
  };
}
function wire(tx:any){db.$transaction.mockImplementation((fn:(t:any)=>Promise<any>)=>fn(tx));}
beforeEach(()=>jest.clearAllMocks());
test("atomically expires provider-verified unpaid order and releases physical stock",async()=>{
  const tx=makeTx();wire(tx);
  expect(await closeVerifiedExpiredCheckout(evidence)).toMatchObject({status:"EXPIRED",holdsReleased:1,replay:false});
  expect(tx.stockHold.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"RELEASED"}}));
  expect(tx.inventoryLevel.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data:{reserved:{decrement:2}},where:expect.objectContaining({organizationId:"org_001",reserved:{gte:2}})}));
  expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"CANCELLED"}}));
  expect(tx.checkoutAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"EXPIRED"}}));
  expect(tx.payment.create).not.toHaveBeenCalled();
  expect(tx.providerEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"PROCESSED"})}));
});
test("duplicate event and other terminal events never double-release",async()=>{
  const closed={...attempt,status:"EXPIRED",order:{...attempt.order,status:"CANCELLED"}};
  const tx=makeTx({attempt:closed,event:{organizationId:"org_001",status:"PROCESSED"}});wire(tx);
  expect(await closeVerifiedExpiredCheckout(evidence)).toMatchObject({replay:true,holdsReleased:0});
  expect(tx.stockHold.findMany).not.toHaveBeenCalled();
  expect(tx.providerEvent.create).not.toHaveBeenCalled();
  const another=makeTx({attempt:closed});wire(another);
  expect(await closeVerifiedExpiredCheckout({...evidence,eventId:"evt_8888888"})).toMatchObject({replay:true});
  expect(another.providerEvent.create).toHaveBeenCalledTimes(1);
});
test("paid, SESSION_CREATING, foreign tenant and unsettled prior event fail closed",async()=>{
  for(const changed of [
    {...attempt,status:"PAID",order:{...attempt.order,status:"PAID"}},
    {...attempt,status:"SESSION_CREATING"},
    {...attempt,connection:{...attempt.connection,accountRef:"acct_foreign"}},
  ]){
    const tx=makeTx({attempt:changed});wire(tx);
    await expect(closeVerifiedExpiredCheckout(evidence)).rejects.toThrow();
    expect(tx.stockHold.updateMany).not.toHaveBeenCalled();
  }
  const tx=makeTx({event:{organizationId:"other",status:"PROCESSED"}});wire(tx);
  await expect(closeVerifiedExpiredCheckout(evidence)).rejects.toThrow("another checkout");
});
test("missing, released or mismatched reservations cannot cancel order",async()=>{
  for(const holds of [[],[{...hold,status:"RELEASED"}],[{...hold,quantity:1}],[{...hold,variantId:"wrong"}]]){
    const tx=makeTx({holds});wire(tx);
    await expect(closeVerifiedExpiredCheckout(evidence)).rejects.toThrow();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  }
  const tx=makeTx();tx.inventoryLevel.updateMany.mockResolvedValue({count:0});wire(tx);
  await expect(closeVerifiedExpiredCheckout(evidence)).rejects.toThrow("Reserved inventory changed");
  expect(tx.order.updateMany).not.toHaveBeenCalled();
});
test("digital-only checkout expires without stock writes",async()=>{
  const a={...attempt,order:{...attempt.order,items:[{...item,fulfillment:"DIGITAL",variant:{inventoryPolicy:"UNLIMITED"}}]}};
  const tx=makeTx({attempt:a,holds:[]});wire(tx);
  expect(await closeVerifiedExpiredCheckout(evidence)).toMatchObject({holdsReleased:0});
  expect(tx.inventoryLevel.updateMany).not.toHaveBeenCalled();
});

test("terminal asynchronous failure cancels unpaid checkout and releases held stock",async()=>{
  const tx=makeTx();wire(tx);
  expect(await closeVerifiedAsyncFailedCheckout(evidence)).toMatchObject({status:"FAILED",holdsReleased:1,replay:false});
  expect(tx.stockHold.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"RELEASED"}}));
  expect(tx.inventoryLevel.updateMany).toHaveBeenCalledTimes(1);
  expect(tx.checkoutAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"FAILED"}}));
  expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"CANCELLED"}}));
  expect(tx.payment.create).not.toHaveBeenCalled();
});
test("failed event replay does not release stock twice; conflicting closure kind is rejected",async()=>{
  const failed={...attempt,status:"FAILED",order:{...attempt.order,status:"CANCELLED"}};
  const tx=makeTx({attempt:failed,event:{organizationId:"org_001",status:"PROCESSED"}});wire(tx);
  expect(await closeVerifiedAsyncFailedCheckout(evidence)).toMatchObject({status:"FAILED",replay:true,holdsReleased:0});
  expect(tx.stockHold.findMany).not.toHaveBeenCalled();
  const next=makeTx({attempt:failed});wire(next);
  await expect(closeVerifiedExpiredCheckout(evidence)).rejects.toThrow();
  expect(next.inventoryLevel.updateMany).not.toHaveBeenCalled();
});
test("async failure cannot undo paid order or uncertain provider handoff",async()=>{
  for(const changed of [
    {...attempt,status:"PAID",order:{...attempt.order,status:"PAID"}},
    {...attempt,status:"SESSION_CREATING"},
    {...attempt,connection:{...attempt.connection,accountRef:"acct_other"}},
  ]) {
    const tx=makeTx({attempt:changed});wire(tx);
    await expect(closeVerifiedAsyncFailedCheckout(evidence)).rejects.toThrow();
    expect(tx.stockHold.updateMany).not.toHaveBeenCalled();
  }
});
