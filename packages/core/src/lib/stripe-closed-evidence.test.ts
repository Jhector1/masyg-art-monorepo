import {validateRetrievedStripeExpiredEvidence} from "./stripe-closed-evidence";
const envelope={status:"VERIFIED" as const,eventId:"evt_12345678",eventType:"checkout.session.expired",
  providerAccount:"acct_1234567",sessionId:"cs_test_12345",attemptId:"attempt_001",orderId:"order_001"};
const meta={attemptId:envelope.attemptId,orderId:envelope.orderId,
  organizationId:"org_001",storeId:"store_001",connectionId:"conn_001"};
const session={id:envelope.sessionId,livemode:false,mode:"payment",status:"expired",payment_status:"unpaid",
  amount_total:1200,currency:"usd",client_reference_id:envelope.attemptId,metadata:meta,payment_intent:null};
test("retrieved expired/unpaid connected-account session is terminal evidence",()=>{
  expect(validateRetrievedStripeExpiredEvidence(envelope,session)).toMatchObject({
    amountMinor:1200,currency:"USD",provider:"stripe",providerAccount:envelope.providerAccount});
});
test("paid, open, complete, wrong event, and wrong merchant never release stock",()=>{
  for(const altered of [
    {...session,status:"open"}, {...session,status:"complete"},
    {...session,payment_status:"paid"}, {...session,livemode:true},
    {...session,metadata:{...meta,orderId:"foreign"}},
    {...session,client_reference_id:"foreign"},
  ]) expect(()=>validateRetrievedStripeExpiredEvidence(envelope,altered)).toThrow();
  expect(()=>validateRetrievedStripeExpiredEvidence({...envelope,eventType:"checkout.session.async_payment_failed"},session)).toThrow();
});
test("only a fully matched canceled PaymentIntent with no money received is safe",()=>{
  const pi={id:"pi_123456",status:"canceled",livemode:false,currency:"usd",
    amount_received:0,metadata:meta};
  expect(validateRetrievedStripeExpiredEvidence(envelope,{...session,payment_intent:pi})).toMatchObject({provider:"stripe"});
  for(const altered of [
    {...pi,status:"processing"},{...pi,status:"succeeded"},
    {...pi,amount_received:10},{...pi,metadata:{...meta,storeId:"foreign"}},
  ])expect(()=>validateRetrievedStripeExpiredEvidence(envelope,{...session,payment_intent:altered})).toThrow();
  expect(()=>validateRetrievedStripeExpiredEvidence(envelope,{...session,payment_intent:"pi_unexpanded"})).toThrow();
});
