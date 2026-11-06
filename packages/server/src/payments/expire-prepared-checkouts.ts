import {prisma} from "@acme/core/lib/prisma";
import {expireUnsubmittedCheckout} from "@acme/core/lib/checkout-transaction";

/** Bounded maintenance task: PREPARED only. Never expire SESSION_CREATING,
 * SESSION_CREATED, PAID or uncertain provider claims without Stripe reconciliation. */
export async function expirePreparedCheckouts(limit=50) {
  if(!Number.isInteger(limit) || limit<1 || limit>100) throw new Error("Invalid batch limit");
  const now=new Date();
  const candidates=await prisma.checkoutAttempt.findMany({where:{
    status:"PREPARED",providerSessionId:null,expiresAt:{lte:now}},
    select:{id:true,organizationId:true,storeId:true},take:limit,orderBy:{expiresAt:"asc"},
  });
  let expired=0;let errors=0;
  for(const attempt of candidates) {
    try {
      const result=await expireUnsubmittedCheckout({attemptId:attempt.id,
        organizationId:attempt.organizationId,storeId:attempt.storeId,now});
      if(result.released) expired++;
    } catch {errors++;}
  }
  return {scanned:candidates.length,expired,errors};
}
