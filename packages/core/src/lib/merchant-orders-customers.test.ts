jest.mock("@acme/core/lib/prisma", () => ({ prisma: {
  order: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  customer: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
}}));
jest.mock("./tenancy", () => ({
  requireMerchantAccess: jest.fn(), validateTenantId: (x: string) => x,
  TenantAccessError: class TenantAccessError extends Error { status = 404; },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { listMerchantOrders, getMerchantOrder, listMerchantCustomers, getMerchantCustomer } from "./merchant-orders-customers";
const access = requireMerchantAccess as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  access.mockImplementation(async (args) => ({ organizationId: args.organizationId, storeId: args.storeId }));
  (prisma.order.count as jest.Mock).mockResolvedValue(0); (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.customer.count as jest.Mock).mockResolvedValue(0); (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);
});
it("lists orders by BOTH organization and selected store with server paging", async () => {
  await listMerchantOrders({userId:"user_1",organizationId:"org_1",storeId:"store_1", page:2,status:"PAID"});
  expect(access).toHaveBeenCalledWith(expect.objectContaining({ organizationId:"org_1",capability:"manage" }));
  expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
    organizationId:"org_1",storeId:"store_1",status:"PAID",
  }, take:25,skip:25 }));
});
it("order detail never loads by a raw ID alone", async () => {
  (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(getMerchantOrder({userId:"user_1",organizationId:"org_1",storeId:"store_1",orderId:"order_1"}))
    .rejects.toMatchObject({status:404});
  expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: {
    id:"order_1",organizationId:"org_1",storeId:"store_1",
  }}));
});
it("customer listing is restricted to purchasers at selected storefront", async () => {
  await listMerchantCustomers({userId:"user_1",organizationId:"org_1",storeId:"store_1"});
  expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({where: {
    organizationId:"org_1",orders:{some:{storeId:"store_1"}},
  }}));
});
it("customer history excludes other storefronts in same organization", async () => {
  (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(getMerchantCustomer({userId:"user_1",organizationId:"org_1",storeId:"store_1",customerId:"cust_1"}))
    .rejects.toMatchObject({status:404});
  expect(prisma.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { id:"cust_1",organizationId:"org_1",orders:{some:{storeId:"store_1"}} },
    select:expect.objectContaining({orders:expect.objectContaining({where:{storeId:"store_1"}})}),
  }));
});
it("denies read if organization-level management permission is absent", async () => {
  access.mockRejectedValueOnce(Object.assign(new Error("Not found"), {status:404}));
  await expect(listMerchantOrders({userId:"user_1",organizationId:"org_2",storeId:"store_1"}))
    .rejects.toMatchObject({status:404});
  expect(prisma.order.findMany).not.toHaveBeenCalled();
});
