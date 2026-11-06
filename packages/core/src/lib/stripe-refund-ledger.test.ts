import {prisma} from "@acme/core/lib/prisma";
import {settleVerifiedFullRefund} from "./stripe-refund-ledger";
jest.mock("@acme/core/lib/prisma",()=>({prisma:{$transaction:jest.fn()}}));
const db=prisma as unknown as {$transaction:jest.Mock};
const evidence={eventId:"evt_test_1234567",providerAccount:"acct_1234567",paymentIntentId:"pi_1234567",
  chargeId:"ch_1234567",organizationId:"org_001",storeId:"store_001",orderId:"order_001",
  amountMinor:1000,currency:"USD"};
const paid={id:"pay_001",status:"SUCCEEDED",order:{id:"order_001",organizationId:"org_001",
  storeId:"store_001",status:"PAID"}};
function makeTx(p=paid,prior:any=null){
  return {payment:{findFirst:jest.fn().mockResolvedValue(p),updateMany:jest.fn().mockResolvedValue({count:1})},
    order:{updateMany:jest.fn().mockResolvedValue({count:1})},
    providerEvent:{findUnique:jest.fn().mockResolvedValue(prior),create:jest.fn().mockResolvedValue({id:"event_001"})},
    digitalGrant:{updateMany:jest.fn().mockResolvedValue({count:1})}};
}
function wire(tx:any){db.$transaction.mockImplementation((fn:(tx:any)=>Promise<unknown>)=>fn(tx));}
beforeEach(()=>jest.clearAllMocks());
test("full refund updates payment, order and revokes grants atomically",async()=>{
  const tx=makeTx();wire(tx);
  expect(await settleVerifiedFullRefund(evidence)).toEqual({status:"REFUNDED",replay:false});
  expect(tx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"REFUNDED"}}));
  expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"REFUNDED"}}));
  expect(tx.digitalGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where:expect.objectContaining({organizationId:evidence.organizationId,item:{orderId:evidence.orderId},revokedAt:null})}));
  expect(tx.providerEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"PROCESSED"})}));
});
test("refund retries do not double revoke",async()=>{
  const tx=makeTx({...paid,status:"REFUNDED",order:{...paid.order,status:"REFUNDED"}},
    {organizationId:evidence.organizationId,status:"PROCESSED"});wire(tx);
  expect(await settleVerifiedFullRefund(evidence)).toEqual({status:"REFUNDED",replay:true});
  expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
  expect(tx.providerEvent.create).not.toHaveBeenCalled();
});
test("foreign account/incorrect amount/partial order states reject",async()=>{
  for(const wrong of [{...paid,order:{...paid.order,storeId:"store_other"}},
    {...paid,status:"FAILED"}, {...paid,order:{...paid.order,status:"PENDING"}}]){
    const tx=makeTx(wrong);wire(tx);
    await expect(settleVerifiedFullRefund(evidence)).rejects.toThrow();
    expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
  }
});
test("well-formed foreign organization cannot settle or revoke an existing order", async () => {
  // Deliberately simulate a stale/mis-scoped DB response. The settlement still
  // compares the stored order organization against the signed evidence.
  const tx = makeTx();
  wire(tx);
  const foreign = { ...evidence, organizationId: "org_other" };
  await expect(settleVerifiedFullRefund(foreign)).rejects.toMatchObject({
    code: "REFUND_OWNER_MISMATCH",
  });
  expect(tx.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      organizationId: foreign.organizationId,
      orderId: foreign.orderId,
      providerAccount: foreign.providerAccount,
      providerPaymentId: foreign.paymentIntentId,
    }),
  }));
  expect(tx.payment.updateMany).not.toHaveBeenCalled();
  expect(tx.order.updateMany).not.toHaveBeenCalled();
  expect(tx.digitalGrant.updateMany).not.toHaveBeenCalled();
  expect(tx.providerEvent.create).not.toHaveBeenCalled();
});

test("provider event replay from another organization fails closed",async()=>{
  const tx=makeTx(paid,{organizationId:"org_other",status:"PROCESSED"});wire(tx);
  await expect(settleVerifiedFullRefund(evidence)).rejects.toThrow();
  expect(tx.payment.updateMany).not.toHaveBeenCalled();
});
