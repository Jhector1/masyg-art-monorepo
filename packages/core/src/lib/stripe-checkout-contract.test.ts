import {planStripeTestSession,verifyStripeTestSession,assertStripeTestCredential} from "./stripe-checkout-contract";
import {providerSessionOperationKey} from "./payment-handoff";
jest.mock("@acme/core/lib/prisma",()=>({prisma:{}}));
const now=new Date("2026-11-02T20:00:00.000Z");
const claim={organizationId:"org_111",storeId:"store_111",attemptId:"attempt_111",orderId:"order_111",
 connectionId:"conn_111",provider:"stripe",providerAccount:"acct_123456789",totalMinor:1250,currency:"USD",
 expiresAt:new Date(now.getTime()+45*60000),};
const email="buyer@example.com";
const hostname="shop.example.com";
const plan=()=>planStripeTestSession(claim,email,hostname,now);
const session=()=>{const p=plan();return {
 id:"cs_test_example123",livemode:false,mode:"payment",status:"open",payment_status:"unpaid",
 amount_total:p.totalMinor,currency:"usd",expires_at:p.expiresAtSeconds,
 client_reference_id:p.attemptId,
 metadata:{attemptId:p.attemptId,orderId:p.orderId,organizationId:p.organizationId,
 storeId:p.storeId,connectionId:p.connectionId,operationKey:p.operationKey},
 url:"https://checkout.stripe.com/c/pay/example123",
};};
test("plans a single server-priced, safe-duration session",()=>{
 const p=plan();expect(p.totalMinor).toBe(1250);
 expect(p.expiresAtSeconds-Math.floor(now.getTime()/1000)).toBe(35*60);
 expect(p.operationKey).toBe(providerSessionOperationKey(claim.attemptId,claim.connectionId));
 expect(p.origin).toBe("https://shop.example.com");
});
test("replay near hold expiry fails closed before contacting Stripe",()=>{
 expect(()=>planStripeTestSession({...claim,expiresAt:new Date(now.getTime()+29*60000)},email,hostname,now)).toThrow("reconciliation");
});
test("cross-account, live secret, client-key drift, and invalid store domain rejected",()=>{
 expect(()=>assertStripeTestCredential("sk_live_abcdef1234567890","acct_123456789")).toThrow("test connection");
 expect(()=>assertStripeTestCredential("sk_test_abcdef1234567890","acct_123456789")).not.toThrow();
 expect(()=>planStripeTestSession({...claim,providerAccount:"acct_bad/other"},email,hostname,now)).toThrow();
 expect(()=>planStripeTestSession({...claim,operationKey:"wrong"},email,hostname,now)).toThrow();
 for(const host of ["localhost", "shop.example.com:443", "evil@example.com", "abc..com"]){
  expect(()=>planStripeTestSession(claim,email,host,now)).toThrow();
 }
});
test("verified provider receipt must bind every merchant/order identifier",()=>{
 const p=plan();const s=session();
 expect(verifyStripeTestSession(s,p,now)).toMatchObject({providerAccount:claim.providerAccount,amountMinor:1250,sessionId:s.id});
});
test("forged or misdirected session cannot attach",()=>{
 const p=plan(),s=session();
 for(const field of [
  {...s,amount_total:1},{...s,currency:"eur"},{...s,livemode:true},
  {...s,client_reference_id:"attempt_foreign"},{...s,metadata:{...s.metadata,organizationId:"org_other"}},
  {...s,metadata:{...s.metadata,operationKey:"wrong"}},
  {...s,status:"complete"},{...s,payment_status:"paid"},
  {...s,expires_at:Math.floor((now.getTime()+50*60000)/1000)},
  {...s,url:"https://evil.example/checkout"},{...s,url:"http://checkout.stripe.com/pay"},
  {...s,id:"cs_live_example"},
 ]) expect(()=>verifyStripeTestSession(field,p,now)).toThrow("cannot be trusted");
});
test("receipt expires before held stock expires",()=>{
 const s=session();const r=verifyStripeTestSession(s,plan(),now);
 expect(r.expiresAt.getTime()).toBeLessThan(claim.expiresAt.getTime());
});
