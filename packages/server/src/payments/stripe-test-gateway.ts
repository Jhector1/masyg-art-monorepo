import Stripe from "stripe";
import { prisma } from "@acme/core/lib/prisma";
import { claimCheckoutForProvider, attachVerifiedProviderSession, providerSessionOperationKey } from "@acme/core/lib/payment-handoff";
import type { PaymentHandoffRef } from "@acme/core/lib/payment-handoff";
import { assertStripeTestCredential, planStripeTestSession, verifyStripeTestSession, stripeTestLocalReturnOrigin } from "@acme/core/lib/stripe-checkout-contract";
import { CommerceInvariantError } from "@acme/core/lib/commerce-invariants";

/** Server-only integration. No public route calls this in v12.
 * Test-mode Connect direct charges, platform API key fetched from external secret store.
 * The secret resolver must authenticate the tenant's verified connection.
 * NEVER expose the key to a browser, database row, log, or JSON response.
 */
export type StripeTestKeyResolver = (secretRef: string) => Promise<string>;

export async function openStripeTestCheckout(
  ref: PaymentHandoffRef,
  loadTestPlatformKey: StripeTestKeyResolver,
  now = new Date(),
) {
  // Local test return URLs are independent of public StoreDomain verification.
  // They require all three explicit runtime safeguards, including a specific local DB.
  const localDevelopmentOrigin = stripeTestLocalReturnOrigin({
    nodeEnv:process.env.NODE_ENV,
    optedIn:process.env.ZILEDIGITAL_STRIPE_TEST_LOCAL_RETURN_ENABLED,
    checkoutEnabled:process.env.ZILEDIGITAL_STRIPE_TEST_CHECKOUT_ENABLED,
    databaseUrl:process.env.DATABASE_URL,
  });
  // Validate prerequisites BEFORE claiming/locking the checkout. A missing domain,
  // customer, or test key must not strand an otherwise valid short-lived stock hold.
  const record = await prisma.checkoutAttempt.findFirst({
    where:{id:ref.attemptId,organizationId:ref.organizationId,storeId:ref.storeId},
    select:{id:true,orderId:true,connectionId:true,
      connection:{select:{organizationId:true,provider:true,accountRef:true,secretRef:true,status:true,verifiedAt:true,capabilities:true}},
      order:{select:{id:true,organizationId:true,storeId:true,status:true,totalMinor:true,currency:true,
        customer:{select:{email:true}}}},
      store:{select:{organizationId:true,domains:{where:{status:"VERIFIED"},select:{hostname:true},take:1}}},
    },
  });
  if (!record || record.id!==ref.attemptId || record.order.id!==record.orderId ||
      record.connection.organizationId!==ref.organizationId ||
      record.order.organizationId!==ref.organizationId || record.order.storeId!==ref.storeId ||
      record.store.organizationId!==ref.organizationId || record.order.status!=="PENDING" ||
      record.connection.provider.toLowerCase()!=="stripe" ||
      record.connection.status!=="VERIFIED" || !record.connection.verifiedAt ||
      !record.connection.capabilities.includes("payments") ||
      !record.order.customer?.email || (!record.store.domains[0]?.hostname && !localDevelopmentOrigin)) {
    throw new CommerceInvariantError("STRIPE_PRECONDITION", "Test Checkout requires a verified merchant, buyer, and domain");
  }
  const key = await loadTestPlatformKey(record.connection.secretRef);
  assertStripeTestCredential(key,record.connection.accountRef);
  const claim = await claimCheckoutForProvider(ref, now);
  // Without a persisted immutable provider-request snapshot, customer email/domain can
  // drift across retries. Reconcile uncertain requests by provider, never re-create blindly.
  if (claim.status==="SESSION_CREATING" && claim.replay) {
    throw new CommerceInvariantError("PROVIDER_RECONCILIATION_REQUIRED", "Uncertain Stripe session requires provider reconciliation");
  }
  if (claim.orderId!==record.orderId || (claim.status==="SESSION_CREATING" && (
    claim.connectionId!==record.connectionId || claim.providerAccount!==record.connection.accountRef ||
    claim.totalMinor!==record.order.totalMinor || claim.currency!==record.order.currency ||
    claim.provider.toLowerCase()!=="stripe"))) {
    throw new CommerceInvariantError("STRIPE_PRECONDITION", "Payment handoff changed during provider request");
  }
  const stripe = new Stripe(key);
  const spec = planStripeTestSession({
    ...ref,orderId:record.order.id,connectionId:record.connectionId,
    provider:record.connection.provider,providerAccount:record.connection.accountRef,
    operationKey:providerSessionOperationKey(ref.attemptId,record.connectionId),
    totalMinor:record.order.totalMinor,currency:record.order.currency,
    expiresAt:claim.expiresAt,
  },record.order.customer.email,record.store.domains[0]?.hostname??"",now,
    claim.status==="SESSION_CREATED",localDevelopmentOrigin);

  let session: Stripe.Checkout.Session;
  if (claim.status==="SESSION_CREATED") {
    // Re-fetch provider session; never blindly return a cached URL.
    session=await stripe.checkout.sessions.retrieve(claim.providerSessionId,{
      stripeAccount:record.connection.accountRef,
    });
  } else {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode:"payment",payment_method_types:["card"],
      customer_email:spec.email,
      client_reference_id:spec.attemptId,
      metadata:{organizationId:spec.organizationId,storeId:spec.storeId,
        attemptId:spec.attemptId,orderId:spec.orderId,connectionId:spec.connectionId,operationKey:spec.operationKey},
      payment_intent_data:{metadata:{organizationId:spec.organizationId,storeId:spec.storeId,
        attemptId:spec.attemptId,orderId:spec.orderId,connectionId:spec.connectionId}},
      line_items:[{price_data:{currency:spec.currency.toLowerCase(),
        unit_amount:spec.totalMinor,product_data:{name:"Store purchase"}},quantity:1}],
      expires_at:spec.expiresAtSeconds,
      success_url:`${spec.origin}/cart/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${spec.origin}/cart?checkout=cancelled`,
    };
    // Stripe handles duplicate retries with the SAME key. Do NOT change the request
    // parameters on retry. A reconciliation path must handle network-unknown results.
    session=await stripe.checkout.sessions.create(sessionParams,{
      idempotencyKey:spec.operationKey,stripeAccount:record.connection.accountRef,
    });
  }
  const verified=verifyStripeTestSession(session,spec,new Date());
  // State storage can fail after provider creation; retry must use the same key,
  // never a second Checkout Session with a different key.
  await attachVerifiedProviderSession(ref,verified,new Date());
  return {orderId:spec.orderId,attemptId:spec.attemptId,
    providerSessionId:verified.sessionId,expiresAt:verified.expiresAt,url:verified.url};
}
