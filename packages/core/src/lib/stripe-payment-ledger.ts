import { prisma } from "@acme/core/lib/prisma";
import type { Prisma } from "@prisma/client";
import { CommerceInvariantError } from "./commerce-invariants";
import type { VerifiedPaidEvidence } from "./stripe-paid-evidence";
import {issuePurchasedDigitalGrants} from "./digital-entitlements";

/** Internal, server-authoritative settlement. No public route, email or file grant.
 * Must ONLY be called with provider evidence retrieved and validated by the
 * trusted signed-webhook adapter. All DB state changes are a single transaction.
 */
const attemptSelect = {
  id:true,organizationId:true,storeId:true,orderId:true,connectionId:true,
  providerSessionId:true,status:true,
  connection:{select:{id:true,organizationId:true,provider:true,accountRef:true,status:true,verifiedAt:true,capabilities:true}},
  order:{select:{id:true,organizationId:true,storeId:true,status:true,totalMinor:true,currency:true,
    items:{select:{id:true,variantId:true,fulfillment:true,quantity:true,
      purchasedFiles:{select:{digitalFileId:true,file:{select:{variantId:true,asset:{select:{private:true}}}}}},
      variant:{select:{inventoryPolicy:true}}}}}},
} satisfies Prisma.CheckoutAttemptSelect;
type Attempt = Prisma.CheckoutAttemptGetPayload<{select:typeof attemptSelect}>;

function validated(e:VerifiedPaidEvidence) {
  if (!e || e.provider!=="stripe" ||
      !/^evt_[A-Za-z0-9_]{6,}$/.test(e.providerEventId) ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(e.providerAccount) ||
      !/^cs_test_[A-Za-z0-9_]+$/.test(e.sessionId) ||
      !/^pi_[A-Za-z0-9_]+$/.test(e.providerPaymentId) ||
      !e.attemptId || !e.orderId ||
      !Number.isSafeInteger(e.amountMinor) || e.amountMinor<=0 || e.amountMinor>2147483647 ||
      !/^[A-Z]{3}$/.test(e.currency)) {
    throw new CommerceInvariantError("PAYMENT_EVIDENCE_INVALID","Verified payment evidence required");
  }
}
function assertIdentity(a:Attempt,e:VerifiedPaidEvidence) {
  if (a.id!==e.attemptId || a.orderId!==e.orderId ||
      a.providerSessionId!==e.sessionId ||
      a.connection.id!==a.connectionId ||
      a.connection.organizationId!==a.organizationId ||
      a.connection.provider.toLowerCase()!=="stripe" ||
      a.connection.accountRef!==e.providerAccount ||
      a.connection.status!=="VERIFIED" || !a.connection.verifiedAt ||
      !a.connection.capabilities.includes("payments") ||
      a.order.id!==e.orderId || a.order.organizationId!==a.organizationId ||
      a.order.storeId!==a.storeId || a.order.totalMinor!==e.amountMinor ||
      a.order.currency!==e.currency) {
    throw new CommerceInvariantError("PAYMENT_MERCHANT_MISMATCH","Payment does not match checkout merchant, amount or order");
  }
}
async function transaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T> {
  for(let i=0;i<3;i++) {
    try { return await prisma.$transaction(work,{isolationLevel:"Serializable",timeout:12000}); }
    catch(error) {
      if(i===2 || !["P2034","P2002"].includes((error as {code?:string})?.code??""))throw error;
    }
  }
  throw new CommerceInvariantError("TRANSACTION_CONFLICT","Payment transaction retry budget exhausted");
}

/** Mark paid, consume physical stock and create dormant grants atomically. No shipments or download routes.
 * Paid amounts and provider payment IDs must match the immutable order snapshot.
 * A released hold is a fatal reconciliation conflict, never an invitation to oversell.
 */
export async function settleVerifiedPaidCheckout(evidence:VerifiedPaidEvidence) {
  validated(evidence);
  return transaction(async tx=>{
    // Global provider event idempotency prevents reuse across merchants.
    const prior=await tx.providerEvent.findUnique({
      where:{provider_providerEventId:{provider:"stripe",providerEventId:evidence.providerEventId}},
      select:{organizationId:true,status:true},
    });
    const a=await tx.checkoutAttempt.findFirst({where:{
      id:evidence.attemptId,providerSessionId:evidence.sessionId,
      connection:{provider:"stripe",accountRef:evidence.providerAccount},
    },select:attemptSelect});
    if(!a)throw new CommerceInvariantError("CHECKOUT_NOT_FOUND","Paid checkout is not registered to the connected merchant");
    assertIdentity(a,evidence);
    if(prior) {
      if(prior.organizationId!==a.organizationId || prior.status!=="PROCESSED") {
        throw new CommerceInvariantError("PROVIDER_EVENT_CONFLICT","Provider event already assigned or unfinished");
      }
      // Existing event is accepted only if the matching payment and paid order remain persisted.
      if(a.order.status!=="PAID" || a.status!=="PAID")throw new CommerceInvariantError("PAYMENT_STATE_CONFLICT","Processed event has inconsistent order state");
      const paid=await tx.payment.findFirst({where:{organizationId:a.organizationId,orderId:a.orderId,
        provider:"stripe",providerAccount:evidence.providerAccount,
        providerPaymentId:evidence.providerPaymentId,status:"SUCCEEDED",amountMinor:evidence.amountMinor,currency:evidence.currency},select:{id:true}});
      if(!paid)throw new CommerceInvariantError("PAYMENT_STATE_CONFLICT","Processed event missing matching payment");
      return {status:"PAID" as const,orderId:a.orderId,paymentId:paid.id,replay:true as const};
    }
    if(a.order.status==="PAID" || a.status==="PAID") {
      // Distinct success events can refer to the same paid session/PaymentIntent.
      if(a.order.status!=="PAID" || a.status!=="PAID")throw new CommerceInvariantError("PAYMENT_STATE_CONFLICT","Inconsistent payment state");
      const paid=await tx.payment.findFirst({where:{organizationId:a.organizationId,orderId:a.orderId,
        provider:"stripe",providerAccount:evidence.providerAccount,
        providerPaymentId:evidence.providerPaymentId,status:"SUCCEEDED",amountMinor:evidence.amountMinor,currency:evidence.currency},select:{id:true}});
      if(!paid)throw new CommerceInvariantError("PAYMENT_STATE_CONFLICT","Paid attempt is missing the verified payment");
      await tx.providerEvent.create({data:{organizationId:a.organizationId,provider:"stripe",providerEventId:evidence.providerEventId,
        status:"PROCESSED",attempts:1,processedAt:new Date()}});
      return {status:"PAID" as const,orderId:a.orderId,paymentId:paid.id,replay:true as const};
    }
    if(a.order.status!=="PENDING" || a.status!=="SESSION_CREATED") {
      throw new CommerceInvariantError("PAYMENT_STATE_CONFLICT","Order is not awaiting a confirmed payment");
    }
    // A tracked physical line MUST have exactly the required quantity on still-held
    // StockHolds. Unlimited physical and digital lines must not have holds.
    const holds=await tx.stockHold.findMany({where:{organizationId:a.organizationId,item:{orderId:a.orderId}},
      select:{id:true,orderItemId:true,variantId:true,locationId:true,quantity:true,status:true}});
    const holdTotal=new Map<string,number>();
    for(const h of holds){
      if(h.status!=="HELD" || !Number.isSafeInteger(h.quantity) || h.quantity<1)
        throw new CommerceInvariantError("STOCK_HOLD_INVALID","Checkout stock hold was released or changed");
      holdTotal.set(h.orderItemId,(holdTotal.get(h.orderItemId)??0)+h.quantity);
    }
    for(const item of a.order.items) {
      const expected=item.fulfillment==="PHYSICAL" && item.variant.inventoryPolicy==="TRACKED"?item.quantity:0;
      if(!Number.isSafeInteger(expected) || expected<0 || (holdTotal.get(item.id)??0)!==expected)
        throw new CommerceInvariantError("STOCK_HOLD_INVALID","Checkout stock reservation does not match the order");
      holdTotal.delete(item.id);
    }
    if(holdTotal.size)throw new CommerceInvariantError("STOCK_HOLD_INVALID","Orphaned stock reservation");
    for(const h of holds) {
      const consumed=await tx.stockHold.updateMany({where:{id:h.id,organizationId:a.organizationId,status:"HELD"},data:{status:"CONSUMED"}});
      if(consumed.count!==1)throw new CommerceInvariantError("STOCK_HOLD_CHANGED","Stock hold changed during settlement");
      const updated=await tx.inventoryLevel.updateMany({where:{organizationId:a.organizationId,
        variantId:h.variantId,locationId:h.locationId,
        onHand:{gte:h.quantity},reserved:{gte:h.quantity}},
        data:{onHand:{decrement:h.quantity},reserved:{decrement:h.quantity}}});
      if(updated.count!==1)throw new CommerceInvariantError("STOCK_CHANGED","Physical stock cannot be consumed safely");
    }
    const order=await tx.order.updateMany({where:{id:a.orderId,organizationId:a.organizationId,storeId:a.storeId,status:"PENDING"},data:{status:"PAID"}});
    const attempt=await tx.checkoutAttempt.updateMany({where:{id:a.id,organizationId:a.organizationId,storeId:a.storeId,status:"SESSION_CREATED",providerSessionId:evidence.sessionId},data:{status:"PAID"}});
    if(order.count!==1 || attempt.count!==1)throw new CommerceInvariantError("PAYMENT_STATE_CONFLICT","Concurrent payment state change");
    // Same transaction as PAID status, stock consumption and payment row.
    // Snapshot validation failure rolls back everything; no entitlement leaks.
    const grantsIssued=await issuePurchasedDigitalGrants(tx,a.organizationId,a.order.items);
    const payment=await tx.payment.create({data:{organizationId:a.organizationId,orderId:a.orderId,
      provider:"stripe",providerAccount:evidence.providerAccount,providerPaymentId:evidence.providerPaymentId,
      amountMinor:evidence.amountMinor,currency:evidence.currency,status:"SUCCEEDED"},select:{id:true}});
    await tx.providerEvent.create({data:{organizationId:a.organizationId,provider:"stripe",providerEventId:evidence.providerEventId,
      status:"PROCESSED",attempts:1,processedAt:new Date()}});
    return {status:"PAID" as const,orderId:a.orderId,paymentId:payment.id,grantsIssued,replay:false as const};
  });
}
