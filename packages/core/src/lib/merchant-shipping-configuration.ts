import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { validateStoreShippingSettings } from "./store-shipping-policy";

const empty = {enabled:false,physicalTaxCode:null,shippingTaxCode:null,rates:[]};

export async function readMerchantShippingSettings(args:{userId:string;organizationId:string;storeId:string}) {
  const scope = await requireMerchantAccess({...args,capability:"read"});
  const [config,rates] = await Promise.all([
    prisma.storeShippingConfiguration.findUnique({where:{organizationId_storeId:{organizationId:scope.organizationId,storeId:scope.storeId!}},
      select:{enabled:true,physicalTaxCode:true,shippingTaxCode:true}}),
    prisma.storeShippingRate.findMany({where:{organizationId:scope.organizationId,storeId:scope.storeId!},
      select:{country:true,region:true,currency:true,amountMinor:true,enabled:true},
      orderBy:[{country:"asc"},{region:"asc"},{currency:"asc"}],take:40}),
  ]);
  return { ...empty, ...config, rates };
}

/** Merchant mutations are tenant-scoped, audited, and atomic. No payment creation. */
export async function saveMerchantShippingSettings(args:{userId:string;organizationId:string;storeId:string;body:unknown}) {
  const scope=await requireMerchantAccess({...args,capability:"manage"});
  const value=validateStoreShippingSettings(args.body);
  for (let attempt=0;attempt<3;attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.storeShippingConfiguration.upsert({
          where:{organizationId_storeId:{organizationId:scope.organizationId,storeId:scope.storeId!}},
          update:{enabled:value.enabled,physicalTaxCode:value.physicalTaxCode,shippingTaxCode:value.shippingTaxCode},
          create:{organizationId:scope.organizationId,storeId:scope.storeId!,enabled:value.enabled,
            physicalTaxCode:value.physicalTaxCode,shippingTaxCode:value.shippingTaxCode},
        });
        await tx.storeShippingRate.deleteMany({where:{organizationId:scope.organizationId,storeId:scope.storeId!}});
        if(value.rates.length) await tx.storeShippingRate.createMany({data:value.rates.map(rate=>({
          organizationId:scope.organizationId,storeId:scope.storeId!,...rate,
        }))});
        await tx.merchantAuditLog.create({data:{organizationId:scope.organizationId,actorUserId:args.userId,
          action:"store.shipping.configuration.updated",targetType:"Storefront",targetId:scope.storeId!,
          metadata:{testMixedEnabled:value.enabled,shippingRateCount:value.rates.length}}});
        return value;
      },{isolationLevel:"Serializable",timeout:12000});
    } catch (error) {
      if (attempt<2 && error instanceof Error && "code" in error && error.code==="P2034") continue;
      throw error;
    }
  }
  throw new Error("Shipping settings could not be saved");
}

/** Server-only quote input. A client cannot select a shipping rate or tax code. */
export async function resolveStoreShippingSettings(organizationId:string,storeId:string) {
  const [config,rates]=await Promise.all([
    prisma.storeShippingConfiguration.findUnique({where:{organizationId_storeId:{organizationId,storeId}},
      select:{enabled:true,physicalTaxCode:true,shippingTaxCode:true}}),
    prisma.storeShippingRate.findMany({where:{organizationId,storeId,enabled:true},
      select:{id:true,organizationId:true,storeId:true,country:true,region:true,currency:true,amountMinor:true,enabled:true},take:40}),
  ]);
  return {config,rates};
}
