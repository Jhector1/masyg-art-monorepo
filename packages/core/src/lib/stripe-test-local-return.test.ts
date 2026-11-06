import { planStripeTestSession, stripeTestLocalReturnOrigin } from "./stripe-checkout-contract";

const localDb = "postgresql://dev:password@localhost:5432/haitian_art_store?schema=ziledigital";
const eligible = {
  nodeEnv:"development", optedIn:"true", checkoutEnabled:"true", databaseUrl:localDb,
};
const now = new Date("2026-11-05T20:00:00Z");
const claim = {
  organizationId:"org_001", storeId:"store_001", attemptId:"attempt_001",
  orderId:"order_001", connectionId:"connection_001", provider:"stripe",
  providerAccount:"acct_123456789", totalMinor:8000, currency:"USD",
  expiresAt:new Date(now.getTime()+45*60_000),
};

test("explicit dev opt-in allows only the exact localhost test return and target DB",()=>{
  expect(stripeTestLocalReturnOrigin(eligible)).toBe("http://localhost:3001");
  expect(stripeTestLocalReturnOrigin({...eligible,databaseUrl:"postgres://a:b@127.0.0.1:5432/haitian_art_store?schema=ziledigital"}))
    .toBe("http://localhost:3001");
  for (const changed of [
    {...eligible,nodeEnv:"production"},
    {...eligible,nodeEnv:"test"},
    {...eligible,optedIn:"false"},
    {...eligible,optedIn:undefined},
    {...eligible,checkoutEnabled:"false"},
    {...eligible,databaseUrl:"postgres://a:b@remote.example:5432/haitian_art_store?schema=ziledigital"},
    {...eligible,databaseUrl:"postgres://a:b@localhost:5433/haitian_art_store?schema=ziledigital"},
    {...eligible,databaseUrl:"postgres://a:b@localhost:5432/other?schema=ziledigital"},
    {...eligible,databaseUrl:"postgres://a:b@localhost:5432/haitian_art_store?schema=public"},
    {...eligible,databaseUrl:""},
  ]) expect(stripeTestLocalReturnOrigin(changed)).toBeNull();
});

test("verified public domains still produce HTTPS URLs",()=>{
  const session = planStripeTestSession(claim,"buyer@example.com","store.example.com",now);
  expect(session.origin).toBe("https://store.example.com");
});

test("no domain still fails without explicit local eligibility",()=>{
  expect(()=>planStripeTestSession(claim,"buyer@example.com","",now)).toThrow();
  expect(()=>planStripeTestSession(claim,"buyer@example.com","localhost",now)).toThrow();
  expect(()=>planStripeTestSession(claim,"buyer@example.com","localhost",now,false,"http://localhost:3001"))
    .toThrow();
});

test("approved local return never affects tenant, merchant or payment validation",()=>{
  const session = planStripeTestSession(claim,"buyer@example.com","",now,false,"http://localhost:3001");
  expect(session.origin).toBe("http://localhost:3001");
  expect(session.totalMinor).toBe(8000);
  expect(()=>planStripeTestSession({...claim,providerAccount:"bogus"},"buyer@example.com","",now,false,"http://localhost:3001"))
    .toThrow();
  expect(()=>planStripeTestSession({...claim,totalMinor:-1},"buyer@example.com","",now,false,"http://localhost:3001"))
    .toThrow();
  expect(()=>planStripeTestSession(claim,"not_an_email","",now,false,"http://localhost:3001"))
    .toThrow();
});
