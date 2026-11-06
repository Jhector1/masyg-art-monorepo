import {validateRetrievedStripeAsyncFailureEvidence as validate} from "./stripe-async-failed-evidence";
const event={status:"VERIFIED" as const,eventId:"evt_12345678",eventType:"checkout.session.async_payment_failed",
  providerAccount:"acct_1234567",sessionId:"cs_test_12345",attemptId:"attempt_001",orderId:"order_001"};
const meta={attemptId:event.attemptId,orderId:event.orderId,
  organizationId:"org_001",storeId:"store_001",connectionId:"conn_001"};
const intent={id:"pi_1234567",status:"canceled",livemode:false,amount_received:0,currency:"usd",metadata:meta};
const session={id:event.sessionId,livemode:false,mode:"payment",status:"complete",payment_status:"unpaid",
  amount_total:2500,currency:"usd",client_reference_id:event.attemptId,metadata:meta,payment_intent:intent};
test("signed+retrieved canceled zero-received async payment is terminal failure",()=>{
  expect(validate(event,session)).toMatchObject({provider:"stripe",eventId:event.eventId,
    amountMinor:2500,currency:"USD"});
});
test("unexpanded/missing or retryable payment intent stays reserved",()=>{
  expect(validate(event,{...session,payment_intent:null})).toBeNull();
  expect(validate(event,{...session,payment_intent:"pi_1234567"})).toBeNull();
  for(const status of ["processing","requires_payment_method","requires_confirmation","requires_action","requires_capture"]){
    expect(validate(event,{...session,payment_intent:{...intent,status}})).toBeNull();
  }
});
test("paid, succeeded, nonzero received, or incorrect merchant evidence fails closed",()=>{
  for(const changed of [
    {...session,payment_status:"paid"},
    {...session,status:"open"},
    {...session,livemode:true},
    {...session,payment_intent:{...intent,status:"succeeded"}},
    {...session,payment_intent:{...intent,amount_received:1}},
    {...session,payment_intent:{...intent,metadata:{...meta,storeId:"other"}}},
    {...session,payment_intent:{...intent,currency:"eur"}},
    {...session,metadata:{...meta,connectionId:"different"}},
  ]) expect(()=>validate(event,changed)).toThrow();
  expect(()=>validate({...event,eventType:"checkout.session.expired"},session)).toThrow();
});
