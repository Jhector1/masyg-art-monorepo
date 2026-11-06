import { prisma } from "@acme/core/lib/prisma";
import type { Prisma } from "@prisma/client";
import { CommerceInvariantError } from "./commerce-invariants";

/** Full-refund evidence is assembled ONLY from signed webhook + retrieved Stripe
 * Charge and PaymentIntent on the verified connected account. Not buyer input. */
export type VerifiedFullRefund = {
  eventId:string;providerAccount:string;paymentIntentId:string;chargeId:string;
  amountMinor:number;currency:string;orderId:string;organizationId:string;storeId:string;
};
export function validateFullRefundEvidence(e:VerifiedFullRefund) {
  if (!/^evt_[A-Za-z0-9_]{6,}$/.test(e.eventId) ||
      !/^acct_[A-Za-z0-9]{6,}$/.test(e.providerAccount) ||
      !/^pi_[A-Za-z0-9_]+$/.test(e.paymentIntentId) ||
      !/^ch_[A-Za-z0-9_]+$/.test(e.chargeId) ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(e.orderId) ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(e.storeId) ||
      !/^[A-Za-z0-9_-]{3,128}$/.test(e.organizationId) ||
      !Number.isSafeInteger(e.amountMinor) || e.amountMinor<1 || e.amountMinor>2147483647 ||
      !/^[A-Z]{3}$/.test(e.currency))
    throw new CommerceInvariantError("REFUND_EVIDENCE_INVALID","Invalid full-refund evidence");
}

/** Refunds revoke digital access atomically but deliberately NEVER restock shipped goods.
 * Partial refunds require a separate apportioned/refund domain and are not booked here. */
export async function settleVerifiedFullRefund(e:VerifiedFullRefund) {
  validateFullRefundEvidence(e);
  for(let attempt=0;attempt<3;attempt++) {
    try {
      return await prisma.$transaction(async (tx:Prisma.TransactionClient)=>{
        const payment=await tx.payment.findFirst({where:{
          organizationId:e.organizationId,orderId:e.orderId,provider:"stripe",
          providerAccount:e.providerAccount,providerPaymentId:e.paymentIntentId,
          amountMinor:e.amountMinor,currency:e.currency,
        },select:{id:true,status:true,
          order:{select:{id:true,organizationId:true,storeId:true,status:true}}}});
        if (!payment || payment.order.organizationId!==e.organizationId ||
            payment.order.storeId!==e.storeId || payment.order.id!==e.orderId)
          throw new CommerceInvariantError("REFUND_OWNER_MISMATCH","Refund is not for the merchant's settled order");
        const previous=await tx.providerEvent.findUnique({where:{
          provider_providerEventId:{provider:"stripe",providerEventId:e.eventId}},
          select:{organizationId:true,status:true},
        });
        if (previous && (previous.organizationId!==e.organizationId || previous.status!=="PROCESSED"))
          throw new CommerceInvariantError("REFUND_EVENT_CONFLICT","Refund event is not replayable");
        if (payment.status==="REFUNDED" && payment.order.status==="REFUNDED") {
          if(!previous) await tx.providerEvent.create({data:{organizationId:e.organizationId,provider:"stripe",
            providerEventId:e.eventId,status:"PROCESSED",attempts:1,processedAt:new Date()}});
          return {status:"REFUNDED" as const,replay:true as const};
        }
        if (previous || payment.status!=="SUCCEEDED" ||
            !["PAID","FULFILLING","FULFILLED"].includes(payment.order.status))
          throw new CommerceInvariantError("REFUND_STATE_CONFLICT","Refund order state conflict");
        const date=new Date();
        const updated=await tx.payment.updateMany({where:{id:payment.id,organizationId:e.organizationId,status:"SUCCEEDED"},
          data:{status:"REFUNDED"}});
        const order=await tx.order.updateMany({where:{id:e.orderId,organizationId:e.organizationId,
          storeId:e.storeId,status:{in:["PAID","FULFILLING","FULFILLED"]}},
          data:{status:"REFUNDED"}});
        if (updated.count!==1 || order.count!==1)
          throw new CommerceInvariantError("REFUND_STATE_CONFLICT","Concurrent refund state change");
        await tx.digitalGrant.updateMany({where:{organizationId:e.organizationId,item:{orderId:e.orderId},revokedAt:null},
          data:{revokedAt:date}});
        await tx.providerEvent.create({data:{organizationId:e.organizationId,provider:"stripe",
          providerEventId:e.eventId,status:"PROCESSED",attempts:1,processedAt:date}});
        return {status:"REFUNDED" as const,replay:false as const};
      },{isolationLevel:"Serializable",timeout:12000});
    } catch(error) {
      if (attempt===2 || !["P2002","P2034"].includes((error as {code?:string})?.code??"")) throw error;
    }
  }
  throw new CommerceInvariantError("TRANSACTION_CONFLICT","Refund retry budget exhausted");
}
