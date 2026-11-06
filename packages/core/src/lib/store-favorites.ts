import { prisma } from "./prisma";
import { resolvePublishedStore, listPublicProductsByIds } from "./public-catalog";
import { validateTenantId } from "./tenancy";

export class StoreFavoriteAccessError extends Error {
  constructor(public readonly status: 400|401|404, message="Not found") {super(message);this.name="StoreFavoriteAccessError";}
}

export function requireFavoriteProductId(raw:unknown) {
  if (typeof raw!=="string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(raw))
    throw new StoreFavoriteAccessError(400,"Invalid product ID");
  return raw;
}
async function scope(userId:string|null|undefined,storeId:string) {
  if (!userId) throw new StoreFavoriteAccessError(401,"Sign in to manage favorites");
  const user=validateTenantId(userId);
  const store=await resolvePublishedStore(storeId);
  return {user,organizationId:store.organizationId,storeId:store.id};
}

export async function listBuyerStoreFavorites(args:{userId:string|null|undefined;storeId:string}) {
  const s=await scope(args.userId,args.storeId);
  const rows=await prisma.storeFavorite.findMany({
    where:{organizationId:s.organizationId,storeId:s.storeId,userId:s.user},
    select:{productId:true},orderBy:{createdAt:"desc"},take:100,
  });
  const ids=rows.map(row=>row.productId);
  const catalog=await listPublicProductsByIds({storeId:s.storeId,productIds:ids});
  // Do not expose a hidden, unpublished or foreign listing as a favorite.
  const productsById=new Map<string,(typeof catalog.products)[number]>(
    catalog.products.map(p=>[p.product.id,p] as const));
  return {store:catalog.store,favorites:ids.filter(id=>productsById.has(id)),
    products:ids.map(id=>productsById.get(id)).filter((item):item is (typeof catalog.products)[number]=>Boolean(item))};
}

export async function setBuyerStoreFavorite(args:{userId:string|null|undefined;storeId:string;productId:unknown;enabled:boolean}) {
  const s=await scope(args.userId,args.storeId);
  const productId=requireFavoriteProductId(args.productId);
  const key={organizationId:s.organizationId,storeId:s.storeId,userId:s.user,productId};
  if (!args.enabled) {
    await prisma.storeFavorite.deleteMany({where:key});
    return {productId,favorite:false};
  }
  const listing=await prisma.storeListing.findFirst({where:{
    organizationId:s.organizationId,storeId:s.storeId,productId,
    status:"PUBLISHED",product:{status:"PUBLISHED",variants:{some:{active:true}}},
  },select:{productId:true}});
  if (!listing) throw new StoreFavoriteAccessError(404,"Artwork unavailable");
  await prisma.storeFavorite.upsert({
    where:{organizationId_storeId_userId_productId:key},
    create:key,update:{},
  });
  return {productId,favorite:true};
}
