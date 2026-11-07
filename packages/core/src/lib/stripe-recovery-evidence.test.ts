import {validateRecoveredStripePaidEvidence} from "./stripe-recovery-evidence";

const attempt={id:"attempt_abc",organizationId:"org_abc",storeId:"store_abc",orderId:"order_abc",
  connectionId:"conn_abc",status:"SESSION_CREATED",providerSessionId:"cs_test_1234567",
  connection:{id:"conn_abc",organizationId:"org_abc",provider:"stripe",accountRef:"acct_12345678",
    status:"VERIFIED",verifiedAt:new Date(),capabilities:["payments"]},
  order:{id:"order_abc",organizationId:"org_abc",storeId:"store_abc",status:"PENDING",totalMinor:1200,currency:"USD"}};
const meta={attemptId:"attempt_abc",orderId:"order_abc",organizationId:"org_abc",storeId:"store_abc",connectionId:"conn_abc"};
const session={id:"cs_test_1234567",livemode:false,mode:"payment",status:"complete",payment_status:"paid",
  amount_total:1200,currency:"usd",client_reference_id:"attempt_abc",metadata:meta,
  payment_intent:{id:"pi_12345678",status:"succeeded",livemode:false,currency:"usd",amount_received:1200,
    metadata:meta,latest_charge:"ch_12345678"}};
const charge={id:"ch_12345678",livemode:false,status:"succeeded",paid:true,captured:true,
  amount:1200,amount_refunded:0,refunded:false,currency:"usd",payment_intent:"pi_12345678"};
const refunds={data:[],has_more:false};
const good={attempt,session,charge,refunds};
test("valid provider evidence contains source and no invented Stripe webhook event",()=>{
  const evidence=validateRecoveredStripePaidEvidence(good);
  expect(evidence).toMatchObject({source:"PROVIDER_RETRIEVAL",providerPaymentId:"pi_12345678",
    organizationId:"org_abc",storeId:"store_abc",connectionId:"conn_abc"});
  expect("providerEventId" in evidence).toBe(false);
});
test.each([
  {attempt:{...attempt,status:"SESSION_CREATING"}},
  {attempt:{...attempt,order:{...attempt.order,status:"REFUNDED"}}},
  {attempt:{...attempt,organizationId:"other_org"}},
  {attempt:{...attempt,connection:{...attempt.connection,organizationId:"other_org"}}},
  {session:{...session,livemode:true}},
  {session:{...session,metadata:{...meta,storeId:"other"}}},
  {session:{...session,amount_total:1300}},
  {session:{...session,payment_status:"unpaid"}},
  {session:{...session,payment_intent:"pi_12345678"}},
  {session:{...session,payment_intent:{...session.payment_intent,status:"processing"}}},
  {session:{...session,payment_intent:{...session.payment_intent,metadata:{...meta,connectionId:"other"}}}},
  {charge:{...charge,livemode:true}},
  {charge:{...charge,amount:1300}},
  {charge:{...charge,paid:false}},
  {charge:{...charge,captured:false}},
  {charge:{...charge,amount_refunded:100}},
  {charge:{...charge,refunded:true}},
  {charge:{...charge,payment_intent:"pi_other"}},
  {refunds:{data:[{id:"re_123456"}],has_more:false}},
  {refunds:{data:[],has_more:true}},
])("rejects mismatched, uncertain, refunded or cross-tenant provider evidence %#",override=>{
  expect(()=>validateRecoveredStripePaidEvidence({...good,...override})).toThrow();
});
