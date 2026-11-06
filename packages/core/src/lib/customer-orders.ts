import { prisma } from "@acme/core/lib/prisma";
import { validateTenantId } from "./tenancy";

const orderReadSelect = {id:true,status:true,currency:true,subtotalMinor:true,taxMinor:true,shippingMinor:true,totalMinor:true,createdAt:true,
  items:{select:{id:true,titleSnapshot:true,skuSnapshot:true,fulfillment:true,quantity:true,unitPriceMinor:true,totalMinor:true,variant:{select:{productId:true,product:{select:{media:{where:{asset:{private:false}},select:{assetId:true},orderBy:{sortOrder:"asc"},take:1}}}}}}},
} as const;

export class CustomerOrderAccessError extends Error {
  constructor(public readonly status:401|404, message="Not found") {
    super(message); this.name="CustomerOrderAccessError";
  }
}
/** The user ID comes exclusively from a server-authenticated session. */
export async function listCustomerOrders(args:{ userId:string|null|undefined; storeId:string }) {
  if (!args.userId) throw new CustomerOrderAccessError(401,"Unauthorized");
  const storeId=validateTenantId(args.storeId);
  const store=await prisma.storefront.findUnique({where:{id:storeId},select:{organizationId:true}});
  if (!store) throw new CustomerOrderAccessError(404);
  const orders=await prisma.order.findMany({
    where:{organizationId:store.organizationId,storeId,customer:{is:{userId:args.userId}}},
    select:orderReadSelect,
    orderBy:{createdAt:"desc"},take:50,
  });
  return {orders};
}

/** Read a single order only through its authenticated buyer, organization and storefront. */
export async function getCustomerOrder(args:{userId:string|null|undefined;storeId:string;orderId:string}) {
  if (!args.userId) throw new CustomerOrderAccessError(401,"Unauthorized");
  const storeId=validateTenantId(args.storeId);
  const orderId=validateTenantId(args.orderId);
  const store=await prisma.storefront.findUnique({where:{id:storeId},select:{organizationId:true}});
  if (!store) throw new CustomerOrderAccessError(404);
  const order=await prisma.order.findFirst({
    where:{id:orderId,organizationId:store.organizationId,storeId,customer:{is:{userId:args.userId}}},
    select:orderReadSelect,
  });
  if (!order) throw new CustomerOrderAccessError(404);
  return {order};
}
