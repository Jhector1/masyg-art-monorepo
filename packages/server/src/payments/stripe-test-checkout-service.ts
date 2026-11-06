import Stripe from "stripe";
import { prisma } from "@acme/core/lib/prisma";
import { hashGuestCartToken } from "@acme/auth/guestIdentity";
import { getGuestCart } from "@acme/core/lib/cart-service";
import { checkoutQuoteFingerprint, prepareCheckoutAttempt, expireUnsubmittedCheckout } from "@acme/core/lib/checkout-transaction";
import { CHECKOUT_PREPARED_EXPIRED } from "@acme/core/lib/stripe-test-checkout-retry-policy";
import { hashIdempotencyKey, CommerceInvariantError } from "@acme/core/lib/commerce-invariants";
import { assertStripeTestCredential } from "@acme/core/lib/stripe-checkout-contract";
import { isStripeTaxCalculationId } from "@acme/core/lib/stripe-tax-calculation-id";
import { stripeTestCheckoutInput, digitalTaxCode, trustedDigitalQuote, contactForCheckout } from "@acme/core/lib/stripe-test-checkout-input";
import { openStripeTestCheckout } from "./stripe-test-gateway";
import { planMixedCheckoutQuote, verifyMixedStripeTaxQuote } from "@acme/core/lib/mixed-checkout-quote-policy";
import { resolveStoreShippingSettings } from "@acme/core/lib/merchant-shipping-configuration";
import { mixedTestCheckoutAllowed } from "@acme/core/lib/store-shipping-policy";

/** Signed-in TEST checkout. Physical/mixed carts are independently gated and
 * require merchant-scoped server shipping rates and Stripe Tax reconciliation.
 * Never enable for live payments or accept client-supplied rate/amount/tax. */
export function stripeTestCheckoutEnabled() {
  return process.env.ZILEDIGITAL_STRIPE_TEST_CHECKOUT_ENABLED === "true";
}
export async function mixedTestCheckoutEnabledForStore(organizationId:string,storeId:string) {
  if (!stripeTestCheckoutEnabled() || process.env.ZILEDIGITAL_STRIPE_TEST_MIXED_CHECKOUT_ENABLED!=="true") return false;
  const shipping=await resolveStoreShippingSettings(organizationId,storeId);
  return mixedTestCheckoutAllowed({serverFlag:process.env.ZILEDIGITAL_STRIPE_TEST_MIXED_CHECKOUT_ENABLED,
    merchantEnabled:shipping.config?.enabled===true,rateCount:shipping.rates.length});
}
export async function getStripeTestPlatformKey(secretRef:string) {
  if (secretRef !== "env:ZILEDIGITAL_STRIPE_TEST_PLATFORM_KEY")
    throw new CommerceInvariantError("STRIPE_SECRET_UNAVAILABLE","Unknown merchant secret reference");
  const key=process.env.ZILEDIGITAL_STRIPE_TEST_PLATFORM_KEY??"";
  if (!/^sk_test_[A-Za-z0-9]{8,}$/.test(key))
    throw new CommerceInvariantError("STRIPE_SECRET_UNAVAILABLE","Stripe test key unavailable");
  return key;
}


/** Recover only this authenticated buyer's expired, never-submitted orders.
 * The shared checkout transaction performs CAS and releases stock atomically.
 * Do not touch SESSION_CREATING, SESSION_CREATED, or unknown provider outcomes. */
async function releaseExpiredBuyerPreparedAttempts(args:{
  organizationId:string;storeId:string;userId:string;
}) {
  const now=new Date();
  const candidates=await prisma.checkoutAttempt.findMany({where:{
    organizationId:args.organizationId,storeId:args.storeId,
    status:"PREPARED",providerSessionId:null,expiresAt:{lte:now},
    order:{status:"PENDING",customer:{userId:args.userId}},
  },select:{id:true},orderBy:{expiresAt:"asc"},take:21});
  if(candidates.length>20)
    throw new CommerceInvariantError("CHECKOUT_RECOVERY_LIMIT","Too many expired checkouts require reconciliation");
  for(const attempt of candidates) {
    await expireUnsubmittedCheckout({organizationId:args.organizationId,
      storeId:args.storeId,attemptId:attempt.id,now});
  }
}

/** Race-safe boundary if a PREPARED attempt expires after the initial sweep.
 * Never disguise SESSION_CREATING uncertainty as a safe client retry. */
async function openOrCloseExpiredPrepared(args:{
  organizationId:string;storeId:string;attemptId:string;userId:string;
}) {
  try {
    return await openStripeTestCheckout({organizationId:args.organizationId,
      storeId:args.storeId,attemptId:args.attemptId},getStripeTestPlatformKey);
  } catch(error) {
    if (!(error instanceof CommerceInvariantError) ||
      (error.code!=="PROVIDER_RECONCILIATION_REQUIRED" && error.code!=="CHECKOUT_CLOSED"))
      throw error;
    const now=new Date();
    const safe=await prisma.checkoutAttempt.findFirst({where:{
      id:args.attemptId,organizationId:args.organizationId,storeId:args.storeId,
      status:"PREPARED",providerSessionId:null,expiresAt:{lte:now},
      order:{status:"PENDING",customer:{userId:args.userId}},
    },select:{id:true}});
    if(!safe) throw error;
    await expireUnsubmittedCheckout({organizationId:args.organizationId,
      storeId:args.storeId,attemptId:safe.id,now});
    throw new CommerceInvariantError(CHECKOUT_PREPARED_EXPIRED,
      "Previous checkout expired before reaching Stripe; retry with a fresh checkout request");
  }
}

export async function createDigitalStripeTestCheckout(args:{
  organizationId:string;storeId:string;userId:string;email:string;
  rawCartToken:string|undefined;body:unknown;
}) {
  if (!stripeTestCheckoutEnabled())
    throw new CommerceInvariantError("CHECKOUT_DISABLED","Test checkout is not enabled");
  const input=stripeTestCheckoutInput.parse(args.body);
  const [user, connections] = await Promise.all([
    prisma.user.findUnique({where:{id:args.userId},select:{id:true,email:true}}),
    prisma.integrationConnection.findMany({where:{organizationId:args.organizationId,
      provider:"stripe",status:"VERIFIED",capabilities:{has:"payments"}},
      select:{id:true,organizationId:true,accountRef:true,secretRef:true,capabilities:true},take:2}),
  ]);
  if (!user || user.email.toLowerCase() !== args.email.toLowerCase() || connections.length!==1)
    throw new CommerceInvariantError("CHECKOUT_UNAVAILABLE","Verified buyer and unique merchant connection required");
  const connection=connections[0];
  if(!connection) throw new CommerceInvariantError("CHECKOUT_UNAVAILABLE","Merchant connection missing");
  const key=await getStripeTestPlatformKey(connection.secretRef);
  assertStripeTestCredential(key,connection.accountRef);
  // The buyer cannot select a merchant account, shipping rate, or tax class.
  if (!args.rawCartToken) throw new CommerceInvariantError("EMPTY_CART","Cart is empty");
  // Expired buyer-owned PREPARED holds otherwise make otherwise-available stock look sold out.
  await releaseExpiredBuyerPreparedAttempts({organizationId:args.organizationId,
    storeId:args.storeId,userId:user.id});
  const cart=await getGuestCart({storeId:args.storeId,rawToken:args.rawCartToken});
  if (!cart.currency || !/^[A-Z]{3}$/.test(cart.currency) ||
      !cart.items.length || cart.items.length>100 || cart.issues.length ||
      cart.items.some(item=>!item.available ||
        (item.fulfillment!=="PHYSICAL" && item.fulfillment!=="DIGITAL") ||
        item.currency!==cart.currency || !Number.isSafeInteger(item.lineMinor) || item.lineMinor<1) ||
      !Number.isSafeInteger(cart.subtotalMinor) || cart.subtotalMinor<1 ||
      cart.items.reduce((s,i)=>s+i.lineMinor,0)!==cart.subtotalMinor)
    throw new CommerceInvariantError("CART_NOT_READY","Checkout requires purchasable editions and consistent server prices");
  const includesPhysical=cart.items.some(item=>item.fulfillment==="PHYSICAL");
  if (includesPhysical && !(await mixedTestCheckoutEnabledForStore(args.organizationId,args.storeId)))
    throw new CommerceInvariantError("SHIPPING_NOT_QUOTED","Mixed test checkout is not configured for this storefront");
  const idempotencyKeyHash=hashIdempotencyKey(input.idempotencyKey);
  // Replays never recalculate tax (which would produce a new quote fingerprint).
  // The signed-in buyer and tenant must own the existing attempt before reuse.
  const existing=await prisma.checkoutAttempt.findUnique({where:{
    organizationId_storeId_idempotencyKeyHash:{organizationId:args.organizationId,
      storeId:args.storeId,idempotencyKeyHash}},
    select:{id:true,organizationId:true,storeId:true,status:true,
      order:{select:{customer:{select:{userId:true,email:true}}}}},
  });
  if (existing) {
    if (existing.order.customer?.userId!==user.id ||
        existing.order.customer.email.toLowerCase()!==user.email.toLowerCase())
      throw new CommerceInvariantError("CHECKOUT_OWNER_MISMATCH","Checkout belongs to another buyer");
    if (existing.status==="EXPIRED")
      throw new CommerceInvariantError(CHECKOUT_PREPARED_EXPIRED,
        "Previous checkout expired before reaching Stripe; retry with a fresh checkout request");
    if (!(["PREPARED","SESSION_CREATED"] as string[]).includes(existing.status))
      throw new CommerceInvariantError("PROVIDER_RECONCILIATION_REQUIRED","Checkout needs provider reconciliation or a new attempt");
    return openOrCloseExpiredPrepared({organizationId:args.organizationId,storeId:args.storeId,
      attemptId:existing.id,userId:user.id});
  }
  const cartRow=await prisma.cart.findFirst({where:{organizationId:args.organizationId,
    storeId:args.storeId,guestTokenHash:hashGuestCartToken(args.rawCartToken)},select:{id:true}});
  if (!cartRow) throw new CommerceInvariantError("EMPTY_CART","Checkout cart unavailable");
  // v39D.5B treats the entered address as both billing and delivery; the form
  // says so explicitly. Region is standardized for shipping-rule matching.
  const address={...input.billingAddress,region:input.billingAddress.region?.trim().toUpperCase()};
  const contact=contactForCheckout(user.email,address);
  const stripe=new Stripe(key);
  const lines=cart.items.map(line=>({variantId:line.variantId,quantity:line.quantity,
    priceMinor:line.unitPriceMinor,currency:line.currency}));
  const fingerprint=checkoutQuoteFingerprint({
    organizationId:args.organizationId,storeId:args.storeId,
    cartId:cartRow.id,currency:cart.currency,shippingAddress:contact.shippingAddress,lines,
  });
  let quote;
  if (includesPhysical) {
    const shipping=await resolveStoreShippingSettings(args.organizationId,args.storeId);
    if (!shipping.config?.enabled || !shipping.config.physicalTaxCode)
      throw new CommerceInvariantError("SHIPPING_NOT_QUOTED","Shipping tax and rates are not configured");
    const digitalCode=cart.items.some(item=>item.fulfillment==="DIGITAL")
      ? digitalTaxCode(connection.capabilities) : null;
    const policy=planMixedCheckoutQuote({organizationId:args.organizationId,storeId:args.storeId,
      currency:cart.currency,
      destination:{country:address.country,region:address.region},
      lines:cart.items.map(item=>({variantId:item.variantId,fulfillment:item.fulfillment,
        quantity:item.quantity,unitPriceMinor:item.unitPriceMinor,currency:item.currency})),
      merchantRules:shipping.rates.map(rate=>({organizationId:rate.organizationId,storeId:rate.storeId,
        methodId:rate.id,country:rate.country,region:rate.region||null,
        currency:rate.currency,amountMinor:rate.amountMinor,enabled:rate.enabled})),
      variantTaxCodes:cart.items.map(item=>({variantId:item.variantId,
        taxCode:item.fulfillment==="PHYSICAL"?shipping.config!.physicalTaxCode!:digitalCode!})),
      shippingTaxCode:shipping.config.shippingTaxCode??undefined,
    });
    if (policy.subtotalMinor!==cart.subtotalMinor)
      throw new CommerceInvariantError("CHECKOUT_QUOTE_INVALID","Mixed checkout subtotal does not reconcile");
    const calculated=await stripe.tax.calculations.create({
      currency:cart.currency.toLowerCase(),
      customer_details:{address_source:"shipping",address:{
        line1:address.line1,line2:address.line2,city:address.city,state:address.region,
        postal_code:address.postalCode,country:address.country,
      }},
      line_items:policy.taxLines,
      ...(policy.shippingCost?{shipping_cost:policy.shippingCost}:{}),
    },{stripeAccount:connection.accountRef});
    const checked=verifyMixedStripeTaxQuote({organizationId:args.organizationId,storeId:args.storeId,
      currency:cart.currency,fingerprint,subtotalMinor:policy.subtotalMinor,
      shippingMinor:policy.shippingMinor,stripeCalculation:calculated});
    quote=checked;
  } else {
    // Preserve the existing verified digital-only Stripe Tax flow unchanged.
    const code=digitalTaxCode(connection.capabilities);
    const calculated=await stripe.tax.calculations.create({
      currency:cart.currency.toLowerCase(),
      customer_details:{address_source:"billing",address:{
        line1:address.line1,line2:address.line2,city:address.city,state:address.region,
        postal_code:address.postalCode,country:address.country,
      }},
      line_items:cart.items.map(line=>({amount:line.lineMinor,reference:line.variantId,
        tax_behavior:"exclusive" as const,tax_code:code})),
    },{stripeAccount:connection.accountRef});
    if (calculated.livemode!==false || calculated.currency!==cart.currency.toLowerCase() ||
        calculated.tax_amount_inclusive!==0)
      throw new CommerceInvariantError("TAX_QUOTE_INVALID","Stripe Tax returned unexpected mode or currency");
    if (!isStripeTaxCalculationId(calculated.id))
      throw new CommerceInvariantError("TAX_QUOTE_INVALID","Stripe Tax calculation has no valid ID");
    quote=trustedDigitalQuote({organizationId:args.organizationId,storeId:args.storeId,
      currency:cart.currency,cartFingerprint:fingerprint,taxId:calculated.id,
      taxMinor:calculated.tax_amount_exclusive,amountTotal:calculated.amount_total,
      subtotalMinor:cart.subtotalMinor,shippingMinor:0,calculationExpiresAt:calculated.expires_at});
  }
  const prepared=await prepareCheckoutAttempt({storeId:args.storeId,guestCartToken:args.rawCartToken,
    buyerUserId:user.id,contact,idempotencyKey:input.idempotencyKey,
    paymentConnectionId:connection.id,trustedQuote:quote});
  return openOrCloseExpiredPrepared({organizationId:args.organizationId,storeId:args.storeId,
    attemptId:prepared.attemptId,userId:user.id});
}
