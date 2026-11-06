import {prisma} from "@acme/core/lib/prisma";
import {settleVerifiedPaidCheckout} from "./stripe-payment-ledger";
jest.mock("@acme/core/lib/prisma",()=>({prisma:{$transaction:jest.fn()}}));
const db=prisma as unknown as {$transaction:jest.Mock};
const evidence={provider:"stripe" as const,providerEventId:"evt_test_123456",providerAccount:"acct_1234567",
  providerPaymentId:"pi_12345678",sessionId:"cs_test_123",attemptId:"att_001",orderId:"order_001",
  amountMinor:1200,currency:"USD"};
const attempt={id:evidence.attemptId,orderId:evidence.orderId,organizationId:"org_001",storeId:"store_001",connectionId:"conn_001",
  providerSessionId:evidence.sessionId,status:"SESSION_CREATED",connection:{id:"conn_001",organizationId:"org_001",provider:"stripe",
    accountRef:evidence.providerAccount,status:"VERIFIED",verifiedAt:new Date(),capabilities:["payments"]},
  order:{id:evidence.orderId,organizationId:"org_001",storeId:"store_001",status:"PENDING",totalMinor:1200,currency:"USD",
    items:[{id:"line_001",variantId:"variant_001",fulfillment:"PHYSICAL",quantity:2,
      purchasedFiles:[],variant:{inventoryPolicy:"TRACKED"}}]}};
const hold={id:"hold_001",orderItemId:"line_001",variantId:"variant_001",locationId:"loc_001",quantity:2,status:"HELD"};
function makeTx(overrides:{attempt?:any;event?:any;holds?:any[];payment?:any}={}){
  return {
    providerEvent:{findUnique:jest.fn().mockResolvedValue(overrides.event??null),create:jest.fn().mockResolvedValue({id:"event_001"})},
    checkoutAttempt:{findFirst:jest.fn().mockResolvedValue(overrides.attempt??attempt),updateMany:jest.fn().mockResolvedValue({count:1})},
    stockHold:{findMany:jest.fn().mockResolvedValue(overrides.holds??[hold]),updateMany:jest.fn().mockResolvedValue({count:1})},
    inventoryLevel:{updateMany:jest.fn().mockResolvedValue({count:1})},
    order:{updateMany:jest.fn().mockResolvedValue({count:1})},
    payment:{create:jest.fn().mockResolvedValue({id:"pay_001"}),findFirst:jest.fn().mockResolvedValue(overrides.payment??null)},
    digitalGrant:{create:jest.fn().mockResolvedValue({id:"grant_001"})},
  };
}
function wire(tx:any){db.$transaction.mockImplementation((fn:(x:any)=>Promise<any>)=>fn(tx));}
beforeEach(()=>jest.clearAllMocks());
test("paid order, payment event, and stock consumption share one transaction",async()=>{
  const tx=makeTx();wire(tx);
  expect(await settleVerifiedPaidCheckout(evidence)).toMatchObject({status:"PAID",replay:false});
  expect(tx.stockHold.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"CONSUMED"}}));
  expect(tx.inventoryLevel.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data:{onHand:{decrement:2},reserved:{decrement:2}},
    where:expect.objectContaining({organizationId:"org_001",onHand:{gte:2},reserved:{gte:2}}),
  }));
  expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"PAID"}}));
  expect(tx.checkoutAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"PAID"}}));
  expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({providerPaymentId:"pi_12345678",status:"SUCCEEDED"})}));
  expect(tx.providerEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"PROCESSED"})}));
});
test("foreign merchant, amount mismatch and released hold fail closed",async()=>{
  for(const altered of [
    {...attempt,connection:{...attempt.connection,accountRef:"acct_foreign"}},
    {...attempt,order:{...attempt.order,totalMinor:1300}},
  ]){
    const tx=makeTx({attempt:altered});wire(tx);
    await expect(settleVerifiedPaidCheckout(evidence)).rejects.toThrow();
    expect(tx.payment.create).not.toHaveBeenCalled();
  }
  const tx=makeTx({holds:[{...hold,status:"RELEASED"}]});wire(tx);
  await expect(settleVerifiedPaidCheckout(evidence)).rejects.toThrow("stock hold");
  expect(tx.inventoryLevel.updateMany).not.toHaveBeenCalled();
});
test("tracked inventory cannot be consumed if missing or insufficient",async()=>{
  const noHold=makeTx({holds:[]});wire(noHold);
  await expect(settleVerifiedPaidCheckout(evidence)).rejects.toThrow("stock reservation");
  const insufficient=makeTx();insufficient.inventoryLevel.updateMany.mockResolvedValue({count:0});wire(insufficient);
  await expect(settleVerifiedPaidCheckout(evidence)).rejects.toThrow("stock cannot be consumed");
  expect(insufficient.payment.create).not.toHaveBeenCalled();
});
test("identical event replay and second event for same paid intent never double consume",async()=>{
  const paid={...attempt,status:"PAID",order:{...attempt.order,status:"PAID"}};
  const matchingPayment={id:"pay_001"};
  const original=makeTx({attempt:paid,event:{organizationId:"org_001",status:"PROCESSED"},payment:matchingPayment});wire(original);
  expect(await settleVerifiedPaidCheckout(evidence)).toMatchObject({replay:true});
  expect(original.stockHold.findMany).not.toHaveBeenCalled();
  expect(original.providerEvent.create).not.toHaveBeenCalled();
  const different=makeTx({attempt:paid,payment:matchingPayment});wire(different);
  expect(await settleVerifiedPaidCheckout({...evidence,providerEventId:"evt_test_999999"})).toMatchObject({replay:true});
  expect(different.stockHold.findMany).not.toHaveBeenCalled();
  expect(different.providerEvent.create).toHaveBeenCalledTimes(1);
});
test("an event already owned by another organization is never replayed",async()=>{
  const tx=makeTx({event:{organizationId:"org_else",status:"PROCESSED"}});wire(tx);
  await expect(settleVerifiedPaidCheckout(evidence)).rejects.toThrow("already assigned");
  expect(tx.stockHold.findMany).not.toHaveBeenCalled();
});
test("digital-only paid order needs no stock hold",async()=>{
  const digital={...attempt,order:{...attempt.order,items:[{id:"line_d",variantId:"variant_d",fulfillment:"DIGITAL",quantity:1,
    purchasedFiles:[{digitalFileId:"file_d",file:{variantId:"variant_d",asset:{private:true}}}],
    variant:{inventoryPolicy:"UNLIMITED"}}]}};
  const tx=makeTx({attempt:digital,holds:[]});wire(tx);
  expect(await settleVerifiedPaidCheckout(evidence)).toMatchObject({status:"PAID",replay:false});
  expect(tx.inventoryLevel.updateMany).not.toHaveBeenCalled();
  expect(tx.digitalGrant.create).toHaveBeenCalledWith({data:expect.objectContaining({
    organizationId:"org_001",orderItemId:"line_d",digitalFileId:"file_d",
    tokenHash:expect.stringMatching(/^[0-9a-f]{64}$/),
  }),select:{id:true}});
});

test("payment settlement refuses invalid purchased-file metadata before payment commit",async()=>{
  for(const purchasedFiles of [
    [],
    [{digitalFileId:"file_d",file:{variantId:"variant_other",asset:{private:true}}}],
    [{digitalFileId:"file_d",file:{variantId:"variant_d",asset:{private:false}}}],
  ]) {
    const digital={...attempt,order:{...attempt.order,items:[{
      id:"line_d",variantId:"variant_d",fulfillment:"DIGITAL",quantity:1,
      purchasedFiles,variant:{inventoryPolicy:"UNLIMITED"},
    }]}};
    const tx=makeTx({attempt:digital,holds:[]});wire(tx);
    await expect(settleVerifiedPaidCheckout(evidence)).rejects.toThrow();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.providerEvent.create).not.toHaveBeenCalled();
  }
});


test.each(["FULFILLING","FULFILLED"])("signed success replay after %s is idempotent",async orderStatus=>{
  const progressed={...attempt,status:"PAID",order:{...attempt.order,status:orderStatus}};
  const tx=makeTx({attempt:progressed,payment:{id:"pay_001"}});wire(tx);
  const result=await settleVerifiedPaidCheckout({...evidence,providerEventId:"evt_test_later_success"});
  expect(result).toMatchObject({replay:true,status:"PAID"});
  expect(tx.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({status:"SUCCEEDED",providerPaymentId:evidence.providerPaymentId})}));
  expect(tx.stockHold.findMany).not.toHaveBeenCalled();
  expect(tx.inventoryLevel.updateMany).not.toHaveBeenCalled();
  expect(tx.order.updateMany).not.toHaveBeenCalled();
  expect(tx.digitalGrant.create).not.toHaveBeenCalled();
  expect(tx.providerEvent.create).toHaveBeenCalledTimes(1);
});

test("signed success replay after a verified full refund never reinstates entitlements",async()=>{
  const refunded={...attempt,status:"PAID",order:{...attempt.order,status:"REFUNDED"}};
  const prior=makeTx({attempt:refunded,event:{organizationId:"org_001",status:"PROCESSED"},payment:{id:"pay_001"}});wire(prior);
  expect(await settleVerifiedPaidCheckout(evidence)).toMatchObject({replay:true});
  expect(prior.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({status:"REFUNDED"})}));
  expect(prior.providerEvent.create).not.toHaveBeenCalled();
  const distinct=makeTx({attempt:refunded,payment:{id:"pay_001"}});wire(distinct);
  expect(await settleVerifiedPaidCheckout({...evidence,providerEventId:"evt_test_after_refund"})).toMatchObject({replay:true});
  expect(distinct.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({status:"REFUNDED"})}));
  expect(distinct.stockHold.findMany).not.toHaveBeenCalled();
  expect(distinct.digitalGrant.create).not.toHaveBeenCalled();
  expect(distinct.order.updateMany).not.toHaveBeenCalled();
  expect(distinct.payment.create).not.toHaveBeenCalled();
  expect(distinct.providerEvent.create).toHaveBeenCalledTimes(1);
});

test("replay refuses inconsistent settlement status and mismatched recorded payment",async()=>{
  for(const state of [
    {...attempt,status:"SESSION_CREATED",order:{...attempt.order,status:"FULFILLED"}},
    {...attempt,status:"PAID",order:{...attempt.order,status:"PENDING"}},
    {...attempt,status:"PAID",order:{...attempt.order,status:"CANCELLED"}},
  ]) {
    const tx=makeTx({attempt:state,payment:{id:"pay_001"}});wire(tx);
    await expect(settleVerifiedPaidCheckout(evidence)).rejects.toThrow("inconsistent");
    expect(tx.providerEvent.create).not.toHaveBeenCalled();
  }
  const refunded={...attempt,status:"PAID",order:{...attempt.order,status:"REFUNDED"}};
  const tx=makeTx({attempt:refunded});wire(tx);
  await expect(settleVerifiedPaidCheckout(evidence)).rejects.toThrow("matching payment");
  expect(tx.providerEvent.create).not.toHaveBeenCalled();
});
