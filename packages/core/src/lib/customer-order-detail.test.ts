jest.mock("@acme/core/lib/prisma",()=>({prisma:{storefront:{findUnique:jest.fn()},order:{findFirst:jest.fn()}}}));
import { prisma } from "@acme/core/lib/prisma";
import { getCustomerOrder } from "./customer-orders";
const db=prisma as jest.Mocked<typeof prisma>;
beforeEach(()=>jest.clearAllMocks());
test("anonymous order detail cannot reach database",async()=>{
  await expect(getCustomerOrder({userId:null,storeId:"store_001",orderId:"order_001"})).rejects.toMatchObject({status:401});
  expect(db.storefront.findUnique).not.toHaveBeenCalled();
});
test("never reads an order outside authenticated buyer+store+organization",async()=>{
  (db.storefront.findUnique as jest.Mock).mockResolvedValue({organizationId:"org_001"});
  (db.order.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(getCustomerOrder({userId:"buyer_001",storeId:"store_001",orderId:"order_001"})).rejects.toMatchObject({status:404});
  expect(db.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where:{id:"order_001",organizationId:"org_001",storeId:"store_001",customer:{is:{userId:"buyer_001"}}},
    select:expect.objectContaining({items:expect.anything()}),
  }));
});
test("valid buyer receives only minimal order snapshot DTO",async()=>{
  (db.storefront.findUnique as jest.Mock).mockResolvedValue({organizationId:"org_001"});
  (db.order.findFirst as jest.Mock).mockResolvedValue({id:"order_001",totalMinor:500,currency:"USD",items:[]});
  await expect(getCustomerOrder({userId:"buyer_001",storeId:"store_001",orderId:"order_001"}))
    .resolves.toMatchObject({order:{id:"order_001",totalMinor:500}});
  const selection=(db.order.findFirst as jest.Mock).mock.calls[0][0].select;
  expect(selection).not.toHaveProperty("customer");
  expect(selection).not.toHaveProperty("payments");
});
