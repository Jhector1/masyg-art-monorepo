import { validateRetrievedStripePaidEvidence } from "./stripe-paid-evidence";
const envelope={status:"VERIFIED" as const,eventId:"evt_test_123456",eventType:"checkout.session.completed",
  providerAccount:"acct_1234567",sessionId:"cs_test_123",attemptId:"attempt_001",orderId:"order_001"};
const session={id:envelope.sessionId,livemode:false,mode:"payment",status:"complete",payment_status:"paid",amount_total:1200,
  currency:"usd",client_reference_id:envelope.attemptId,metadata:{attemptId:envelope.attemptId,
  orderId:envelope.orderId,organizationId:"org_001",storeId:"store_001",connectionId:"conn_001"},
  payment_intent:{id:"pi_12345678",status:"succeeded",livemode:false,currency:"usd",amount_received:1200,
    metadata:{attemptId:envelope.attemptId,orderId:envelope.orderId,organizationId:"org_001",storeId:"store_001",connectionId:"conn_001"}}};
test("paid evidence requires retrieved successful PaymentIntent and correct ownership",()=>{
  expect(validateRetrievedStripePaidEvidence(envelope,session)).toMatchObject({providerPaymentId:"pi_12345678",amountMinor:1200,currency:"USD"});
  for(const altered of [
    {...session,livemode:true},{...session,payment_status:"unpaid"},{...session,amount_total:1500},
    {...session,metadata:{...session.metadata,orderId:"other"}},
    {...session,payment_intent:{...session.payment_intent,amount_received:100}},
    {...session,payment_intent:{...session.payment_intent,status:"processing"}},
    {...session,payment_intent:{...session.payment_intent,metadata:{...session.payment_intent.metadata,storeId:"foreign"}}},
  ])expect(()=>validateRetrievedStripePaidEvidence(envelope,altered)).toThrow();
});
test("completed but asynchronous unpaid session waits for payment confirmation",()=>{
  expect(validateRetrievedStripePaidEvidence(envelope,{...session,payment_status:"unpaid",payment_intent:null})).toBeNull();
});
test("a processing payment intent remains pending only with consistent merchant identity",()=>{
  const processing={...session,payment_status:"unpaid",
    payment_intent:{...session.payment_intent,status:"processing",amount_received:0}};
  expect(validateRetrievedStripePaidEvidence(envelope,processing)).toBeNull();
  expect(()=>validateRetrievedStripePaidEvidence(envelope,{
    ...processing,payment_intent:{...processing.payment_intent,metadata:{...session.payment_intent.metadata,storeId:"foreign"}},
  })).toThrow();
  expect(()=>validateRetrievedStripePaidEvidence(envelope,{
    ...processing,payment_intent:"pi_unexpanded",
  })).toThrow();
});
test("unpaid session with succeeded payment intent is contradictory and rejected",()=>{
  expect(()=>validateRetrievedStripePaidEvidence(envelope,{...session,payment_status:"unpaid"})).toThrow();
});
test("out-of-scope event types never mark a checkout paid",()=>{
  expect(()=>validateRetrievedStripePaidEvidence({...envelope,eventType:"checkout.session.expired"},session)).toThrow();
});
