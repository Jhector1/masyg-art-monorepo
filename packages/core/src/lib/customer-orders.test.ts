jest.mock("@acme/core/lib/prisma",()=>({prisma:{storefront:{findUnique:jest.fn()},order:{findMany:jest.fn()}}}));
import { prisma } from "@acme/core/lib/prisma";
import { listCustomerOrders } from "./customer-orders";
const db=prisma as jest.Mocked<typeof prisma>;
beforeEach(()=>jest.clearAllMocks());
test("an unauthenticated order request cannot query DB",async()=>{
  await expect(listCustomerOrders({userId:null,storeId:"store_001"})).rejects.toMatchObject({status:401});
  expect(db.storefront.findUnique).not.toHaveBeenCalled();
});
test("unknown store cannot query orders",async()=>{
  (db.storefront.findUnique as jest.Mock).mockResolvedValue(null);
  await expect(listCustomerOrders({userId:"user_001",storeId:"store_001"})).rejects.toMatchObject({status:404});
  expect(db.order.findMany).not.toHaveBeenCalled();
});
test("orders always require matching organization/store AND authenticated user via customer",async()=>{
  (db.storefront.findUnique as jest.Mock).mockResolvedValue({organizationId:"org_001"});
  (db.order.findMany as jest.Mock).mockResolvedValue([]);
  await listCustomerOrders({userId:"user_001",storeId:"store_001"});
  expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where:{organizationId:"org_001",storeId:"store_001",customer:{is:{userId:"user_001"}}},
    select:expect.objectContaining({items:expect.anything()}),take:50,
  }));
});
