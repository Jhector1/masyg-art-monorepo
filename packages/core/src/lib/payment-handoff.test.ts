import {prisma} from "@acme/core/lib/prisma";
import {claimCheckoutForProvider,attachVerifiedProviderSession,providerSessionOperationKey} from "./payment-handoff";

jest.mock("@acme/core/lib/prisma",()=>({prisma:{$transaction:jest.fn()}}));
const db=prisma as unknown as {$transaction:jest.Mock};
const ref={organizationId:"org_001",storeId:"store_001",attemptId:"attempt_001"};
const connection={id:"conn_001",organizationId:ref.organizationId,provider:"stripe",accountRef:"acct_test_001",
  secretRef:"secure/stripe/test",capabilities:["payments"],status:"VERIFIED",verifiedAt:new Date("2026-11-02T00:00:00Z")};
const order={id:"order_001",organizationId:ref.organizationId,storeId:ref.storeId,status:"PENDING",
  currency:"USD",subtotalMinor:1000,taxMinor:80,shippingMinor:120,totalMinor:1200};
const clock=new Date("2026-11-02T20:00:00Z");
function model(status:"PREPARED"|"SESSION_CREATING"|"SESSION_CREATED"="PREPARED"){
  return {id:ref.attemptId,organizationId:ref.organizationId,storeId:ref.storeId,orderId:order.id,
    connectionId:connection.id,status,providerSessionId:status==="SESSION_CREATED"?"cs_test_001":null,
    expiresAt:new Date(clock.getTime()+(status==="PREPARED"?10:45)*60000),
    createdAt:new Date(clock.getTime()-60000),connection,order};
}
function makeTx(attempt:ReturnType<typeof model>|null=model()){
  return {checkoutAttempt:{findFirst:jest.fn().mockResolvedValue(attempt),updateMany:jest.fn().mockResolvedValue({count:1})},
    stockHold:{updateMany:jest.fn().mockResolvedValue({count:1})}};
}
function wire<T>(tx:T){db.$transaction.mockImplementation((fn:(tx:T)=>unknown)=>fn(tx));}
const receipt=(attempt:ReturnType<typeof model>=model("SESSION_CREATING"))=>({
  provider:"stripe",providerAccount:connection.accountRef,sessionId:"cs_test_001",
  operationKey:providerSessionOperationKey(attempt.id,attempt.connectionId),amountMinor:1200,currency:"USD",
  expiresAt:new Date(clock.getTime()+30*60000),
});
beforeEach(()=>jest.clearAllMocks());
test("claim atomically moves PREPARED to SESSION_CREATING and extends all held inventory",async()=>{
  const tx=makeTx();wire(tx);
  const out=await claimCheckoutForProvider(ref,clock);
  expect(out).toMatchObject({status:"SESSION_CREATING",replay:false,totalMinor:1200,currency:"USD",provider:"stripe"});
  expect(out.expiresAt.getTime()).toBe(clock.getTime()+45*60000);
  expect(tx.checkoutAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where:expect.objectContaining({status:"PREPARED",providerSessionId:null,organizationId:ref.organizationId}),
    data:{status:"SESSION_CREATING",expiresAt:out.expiresAt},
  }));
  expect(tx.stockHold.updateMany).toHaveBeenCalledWith({where:{organizationId:ref.organizationId,status:"HELD",item:{orderId:order.id}},data:{expiresAt:out.expiresAt}});
  expect(JSON.stringify(out)).not.toMatch(/secure\/stripe/);
});
test("an uncertain SESSION_CREATING attempt replays exact stable provider operation key without mutating",async()=>{
  const tx=makeTx(model("SESSION_CREATING"));wire(tx);
  const first=await claimCheckoutForProvider(ref,clock);
  const second=await claimCheckoutForProvider(ref,clock);
  expect(first).toMatchObject({status:"SESSION_CREATING",replay:true,operationKey:second.operationKey});
  expect(first.operationKey).toMatch(/^[a-f0-9]{64}$/);
  expect(tx.checkoutAttempt.updateMany).not.toHaveBeenCalled();
  expect(tx.stockHold.updateMany).not.toHaveBeenCalled();
});
test("record verified provider session without marking the order paid",async()=>{
  const tx=makeTx(model("SESSION_CREATING"));wire(tx);
  const out=await attachVerifiedProviderSession(ref,receipt(),clock);
  expect(out).toMatchObject({status:"SESSION_CREATED",replay:false,providerSessionId:"cs_test_001"});
  expect(tx.checkoutAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"SESSION_CREATED",providerSessionId:"cs_test_001"}}));
  expect(tx.stockHold.updateMany).not.toHaveBeenCalled();
});
test("identical session confirmation is idempotent",async()=>{
  const tx=makeTx(model("SESSION_CREATED"));wire(tx);
  expect(await attachVerifiedProviderSession(ref,receipt(),clock)).toMatchObject({replay:true});
  expect(tx.checkoutAttempt.updateMany).not.toHaveBeenCalled();
});
test("wrong account and changed amount/currency/operation key cannot attach session",async()=>{
  const tx=makeTx(model("SESSION_CREATING"));wire(tx);
  const good=receipt();
  for(const changed of [
    {...good,providerAccount:"acct_foreign"},{...good,amountMinor:50},
    {...good,currency:"EUR"},{...good,operationKey:"other"},
    {...good,expiresAt:new Date(clock.getTime()+50*60000)},
  ]){
    await expect(attachVerifiedProviderSession(ref,changed,clock)).rejects.toThrow("provider receipt");
  }
  expect(tx.checkoutAttempt.updateMany).not.toHaveBeenCalled();
});
test("cross organization/store and disabled connections cannot claim",async()=>{
  const tx=makeTx();wire(tx);
  await expect(claimCheckoutForProvider({...ref,organizationId:"org_foreign"},clock)).rejects.toThrow();
  tx.checkoutAttempt.findFirst.mockResolvedValue(model());
  const forbidden={...model(), connection:{...connection,status:"DISABLED"}};
  tx.checkoutAttempt.findFirst.mockResolvedValue(forbidden);
  await expect(claimCheckoutForProvider(ref,clock)).rejects.toThrow("Merchant payment connection");
  expect(tx.checkoutAttempt.updateMany).not.toHaveBeenCalled();
});
test("expired PREPARED and uncertain expired SESSION_CREATING never extend or release inventory",async()=>{
  for(const status of ["PREPARED","SESSION_CREATING"] as const){
    const attempt=model(status);
    attempt.expiresAt=new Date(clock.getTime()-1000);
    const tx=makeTx(attempt);wire(tx);
    await expect(claimCheckoutForProvider(ref,clock)).rejects.toThrow("provider reconciliation");
    expect(tx.stockHold.updateMany).not.toHaveBeenCalled();
    expect(tx.checkoutAttempt.updateMany).not.toHaveBeenCalled();
  }
});
test("two concurrent claim contenders: the losing CAS aborts, without refreshing holds",async()=>{
  const tx=makeTx();tx.checkoutAttempt.updateMany.mockResolvedValue({count:0});wire(tx);
  await expect(claimCheckoutForProvider(ref,clock)).rejects.toThrow("Checkout changed during claim");
  expect(tx.stockHold.updateMany).not.toHaveBeenCalled();
});
test("provider receipt cannot be attached to PREPARED or replace a different session",async()=>{
  const tx=makeTx(model("PREPARED"));wire(tx);
  await expect(attachVerifiedProviderSession(ref,receipt(),clock)).rejects.toThrow("not awaiting");
  // A valid-looking receipt does not authorize attachment before SESSION_CREATING.
  await expect(attachVerifiedProviderSession(ref,{
    ...receipt(), expiresAt:new Date(clock.getTime()+5*60000),
  },clock)).rejects.toThrow("not awaiting");
  const used=model("SESSION_CREATED");used.providerSessionId="cs_test_different";
  tx.checkoutAttempt.findFirst.mockResolvedValue(used);
  await expect(attachVerifiedProviderSession(ref,receipt(),clock)).rejects.toThrow("Different provider session");
  expect(tx.checkoutAttempt.updateMany).not.toHaveBeenCalled();
});

test("SESSION_CREATING with a stored provider session is rejected before receipt validation",async()=>{
  const inconsistent=model("SESSION_CREATING");
  inconsistent.providerSessionId="cs_test_existing";
  const tx=makeTx(inconsistent);wire(tx);
  await expect(attachVerifiedProviderSession(ref,receipt(),clock)).rejects.toThrow("not awaiting");
  expect(tx.checkoutAttempt.updateMany).not.toHaveBeenCalled();
});
