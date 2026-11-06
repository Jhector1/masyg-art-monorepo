import { prisma } from "@acme/core/lib/prisma";
import type { Prisma } from "@prisma/client";
import { CommerceInvariantError } from "./commerce-invariants";
import type { VerifiedExpiredEvidence } from "./stripe-closed-evidence";
import type { VerifiedAsyncFailedEvidence } from "./stripe-async-failed-evidence";

/** Internal provider-confirmed expiration settlement. Stock may be released
 * ONLY after authoritative retrieval of a terminal expired/unpaid Session.
 * All writes are serializable and atomic. No webhook route calls this yet.
 */
const selected = {
  id:true, organizationId:true, storeId:true, orderId:true,
  connectionId:true, providerSessionId:true, status:true,
  connection:{select:{id:true,organizationId:true,provider:true,accountRef:true,
    status:true,verifiedAt:true,capabilities:true}},
  order:{select:{id:true,organizationId:true,storeId:true,status:true,
    totalMinor:true,currency:true,items:{select:{id:true,variantId:true,
      fulfillment:true,quantity:true,variant:{select:{inventoryPolicy:true}}}}}},
} satisfies Prisma.CheckoutAttemptSelect;
type Attempt = Prisma.CheckoutAttemptGetPayload<{select:typeof selected}>;

type ClosureEvidence = VerifiedExpiredEvidence | VerifiedAsyncFailedEvidence;
function validate(e:ClosureEvidence) {
  if (!e || e.provider!=="stripe" ||
      !/^evt_[A-Za-z0-9_]{6,}$/.test(e.eventId) ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(e.providerAccount) ||
      !/^cs_test_[A-Za-z0-9_]+$/.test(e.sessionId) ||
      !e.attemptId || !e.orderId ||
      !Number.isSafeInteger(e.amountMinor) || e.amountMinor<=0 || e.amountMinor>2147483647 ||
      !/^[A-Z]{3}$/.test(e.currency)) {
    throw new CommerceInvariantError("CLOSURE_EVIDENCE_INVALID", "Verified expiration evidence required");
  }
}
function ownership(a:Attempt,e:ClosureEvidence) {
  if (a.id!==e.attemptId || a.orderId!==e.orderId ||
      a.providerSessionId!==e.sessionId ||
      a.connectionId!==a.connection.id ||
      a.connection.organizationId!==a.organizationId ||
      a.connection.provider.toLowerCase()!=="stripe" ||
      a.connection.accountRef!==e.providerAccount ||
      a.connection.status!=="VERIFIED" || !a.connection.verifiedAt ||
      !a.connection.capabilities.includes("payments") ||
      a.order.id!==a.orderId || a.order.organizationId!==a.organizationId ||
      a.order.storeId!==a.storeId || a.order.totalMinor!==e.amountMinor ||
      a.order.currency!==e.currency) {
    throw new CommerceInvariantError("CLOSURE_MERCHANT_MISMATCH", "Expired session does not match merchant or order");
  }
}
async function transact<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T> {
  for(let attempt=0;attempt<3;attempt++){
    try { return await prisma.$transaction(work,{isolationLevel:"Serializable",timeout:12000}); }
    catch(error) { if (attempt===2 || !["P2034","P2002"].includes((error as {code?:string})?.code??"")) throw error; }
  }
  throw new CommerceInvariantError("TRANSACTION_CONFLICT", "Expiration transaction conflict");
}

async function closeVerifiedUnpaidCheckout(evidence:ClosureEvidence, terminal:"EXPIRED"|"FAILED") {
  validate(evidence);
  return transact(async tx=>{
    const previous=await tx.providerEvent.findUnique({
      where:{provider_providerEventId:{provider:"stripe",providerEventId:evidence.eventId}},
      select:{organizationId:true,status:true},
    });
    const a=await tx.checkoutAttempt.findFirst({
      where:{id:evidence.attemptId,orderId:evidence.orderId,providerSessionId:evidence.sessionId,
        connection:{provider:"stripe",accountRef:evidence.providerAccount}},
      select:selected,
    });
    if(!a) throw new CommerceInvariantError("CHECKOUT_NOT_FOUND","Merchant checkout not registered");
    ownership(a,evidence);
    if(previous && (previous.organizationId!==a.organizationId || previous.status!=="PROCESSED")) {
      throw new CommerceInvariantError("PROVIDER_EVENT_CONFLICT","Provider event belongs to another checkout or is unfinished");
    }
    if(a.status===terminal && a.order.status==="CANCELLED") {
      // Replays do not touch stock. A different expired-event ID can be stored
      // against the already-closed session without releasing stock a second time.
      if(!previous) await tx.providerEvent.create({data:{organizationId:a.organizationId,provider:"stripe",
        providerEventId:evidence.eventId,status:"PROCESSED",attempts:1,processedAt:new Date()}});
      return {status:terminal,orderId:a.orderId,holdsReleased:0,replay:true as const};
    }
    // Never release on success, an uncertain handoff, an async payment,
    // or a state that has already been changed by another transaction.
    if(previous || a.status!=="SESSION_CREATED" || a.order.status!=="PENDING") {
      throw new CommerceInvariantError("CLOSURE_STATE_CONFLICT","Checkout is not an unpaid provider-created session");
    }
    const holds=await tx.stockHold.findMany({where:{organizationId:a.organizationId,item:{orderId:a.orderId}},
      select:{id:true,orderItemId:true,variantId:true,locationId:true,quantity:true,status:true}});
    const remaining=new Map<string,{variantId:string;expected:number;actual:number}>(a.order.items.map(item=>[item.id,{
      variantId:item.variantId,
      expected:item.fulfillment==="PHYSICAL" && item.variant.inventoryPolicy==="TRACKED"?item.quantity:0,
      actual:0,
    }]));
    for(const hold of holds){
      const item=remaining.get(hold.orderItemId);
      if(!item || item.variantId!==hold.variantId || hold.status!=="HELD" ||
          !Number.isSafeInteger(hold.quantity) || hold.quantity<=0) {
        throw new CommerceInvariantError("STOCK_HOLD_INVALID","Stock hold cannot be safely released");
      }
      item.actual+=hold.quantity;
      if(!Number.isSafeInteger(item.actual))throw new CommerceInvariantError("STOCK_HOLD_INVALID","Invalid reserved quantity");
    }
    for(const item of remaining.values()) {
      if(!Number.isSafeInteger(item.expected) || item.expected<0 || item.actual!==item.expected) {
        throw new CommerceInvariantError("STOCK_HOLD_INVALID","Missing or mismatched reserved stock");
      }
    }
    for(const hold of holds){
      const h=await tx.stockHold.updateMany({where:{id:hold.id,organizationId:a.organizationId,status:"HELD"},
        data:{status:"RELEASED"}});
      if(h.count!==1)throw new CommerceInvariantError("STOCK_CHANGED","Stock hold changed during expiration");
      const level=await tx.inventoryLevel.updateMany({where:{organizationId:a.organizationId,
        variantId:hold.variantId,locationId:hold.locationId,reserved:{gte:hold.quantity}},
        data:{reserved:{decrement:hold.quantity}}});
      if(level.count!==1)throw new CommerceInvariantError("STOCK_CHANGED","Reserved inventory changed during expiration");
    }
    const changed=await tx.checkoutAttempt.updateMany({where:{id:a.id,organizationId:a.organizationId,
      storeId:a.storeId,status:"SESSION_CREATED",providerSessionId:evidence.sessionId},data:{status:terminal}});
    const order=await tx.order.updateMany({where:{id:a.orderId,organizationId:a.organizationId,
      storeId:a.storeId,status:"PENDING"},data:{status:"CANCELLED"}});
    if(changed.count!==1 || order.count!==1)throw new CommerceInvariantError("CLOSURE_STATE_CONFLICT","Checkout state changed");
    await tx.providerEvent.create({data:{organizationId:a.organizationId,provider:"stripe",
      providerEventId:evidence.eventId,status:"PROCESSED",attempts:1,processedAt:new Date()}});
    return {status:terminal,orderId:a.orderId,holdsReleased:holds.length,replay:false as const};
  });
}

/** v14 API: authoritative expired+unpaid session only. */
export function closeVerifiedExpiredCheckout(evidence:VerifiedExpiredEvidence) {
  return closeVerifiedUnpaidCheckout(evidence,"EXPIRED");
}
/** v15 API: asynchronous failure with an expanded, canceled, zero-received intent. */
export function closeVerifiedAsyncFailedCheckout(evidence:VerifiedAsyncFailedEvidence) {
  return closeVerifiedUnpaidCheckout(evidence,"FAILED");
}
