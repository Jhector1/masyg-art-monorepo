import {createHash,randomBytes} from "node:crypto";
import type {Prisma} from "@prisma/client";
import {CommerceInvariantError} from "./commerce-invariants";

/** No buyer-facing token is issued here. Grants are dormant authorizations.
 * A later authenticated claim flow must rotate tokenHash and return a one-time
 * download token only after independently verifying the buyer's identity.
 */
export type PurchasedDigitalFile = {
  digitalFileId:string;
  file:{variantId:string;asset:{private:boolean}};
};
export type PurchasedOrderLine = {
  id:string;variantId:string;fulfillment:"DIGITAL"|"PHYSICAL";
  quantity:number;purchasedFiles:readonly PurchasedDigitalFile[];
};

/** Called ONLY inside verified payment settlement's SERIALIZABLE transaction.
 * Never call this on a pending order or from public/client data.
 */
export async function issuePurchasedDigitalGrants(
  tx:Prisma.TransactionClient,
  organizationId:string,
  lines:readonly PurchasedOrderLine[],
):Promise<number> {
  let issued=0;
  for(const item of lines) {
    if (!item.id || !item.variantId || !Number.isSafeInteger(item.quantity) || item.quantity<1) {
      throw new CommerceInvariantError("DIGITAL_SNAPSHOT_INVALID","Invalid purchased order line");
    }
    if(item.fulfillment==="PHYSICAL") {
      if(item.purchasedFiles.length!==0)
        throw new CommerceInvariantError("DIGITAL_SNAPSHOT_INVALID","Physical line has digital file entitlements");
      continue;
    }
    if(item.fulfillment!=="DIGITAL" || item.purchasedFiles.length===0)
      throw new CommerceInvariantError("DIGITAL_SNAPSHOT_INVALID","Digital purchase requires a file snapshot");
    const seen=new Set<string>();
    for(const snap of item.purchasedFiles) {
      if(!snap.digitalFileId || seen.has(snap.digitalFileId) ||
         snap.file?.variantId!==item.variantId || snap.file.asset?.private!==true) {
        throw new CommerceInvariantError("DIGITAL_SNAPSHOT_INVALID","Purchased file is not a private file of the paid variant");
      }
      seen.add(snap.digitalFileId);
    }
    for(const snap of item.purchasedFiles) {
      // Token plaintext is deliberately discarded. DO NOT send a download URL
      // from a webhook, email, or create response. Authenticated token issuance
      // and private object proxy are separate required security milestones.
      const tokenHash=createHash("sha256").update(randomBytes(32)).digest("hex");
      await tx.digitalGrant.create({data:{
        organizationId,orderItemId:item.id,digitalFileId:snap.digitalFileId,
        tokenHash,uses:0,maximumUses:null,expiresAt:null,revokedAt:null,
      },select:{id:true}});
      issued++;
    }
  }
  return issued;
}
