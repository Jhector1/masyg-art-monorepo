jest.mock("@acme/core/lib/prisma", () => ({prisma: {
  customerAddress: {findMany: jest.fn(), deleteMany: jest.fn()},
  $transaction: jest.fn(),
}}));
jest.mock("./public-catalog", () => ({resolvePublishedStore: jest.fn()}));
import {prisma} from "@acme/core/lib/prisma";
import {resolvePublishedStore} from "./public-catalog";
import {customerAddressInput, listCustomerAddresses, createCustomerAddress, deleteCustomerAddress} from "./customer-addresses";
const args = {userId: "user_001", storeId: "store_001"};
const row = {label: "Home", street: "1 Main", city: "Chicago", state: "IL", postalCode: "60601", country: "us"};
beforeEach(() => {
  jest.clearAllMocks();
  (resolvePublishedStore as jest.Mock).mockResolvedValue({organizationId: "org_001", id: "store_001"});
});
it("validates fields, rejects extra keys, and normalizes country", () => {
  expect(customerAddressInput.parse(row).country).toBe("US");
  expect(customerAddressInput.safeParse({...row, userId: "other_001"}).success).toBe(false);
  expect(customerAddressInput.safeParse({...row, street: " "}).success).toBe(false);
});
it("never reads another storefront's addresses", async () => {
  (prisma.customerAddress.findMany as jest.Mock).mockResolvedValue([]);
  await listCustomerAddresses(args);
  expect(prisma.customerAddress.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: {organizationId: "org_001", storeId: "store_001", userId: "user_001"}, take: 30,
  }));
  (resolvePublishedStore as jest.Mock).mockRejectedValue({status: 404});
  await expect(listCustomerAddresses({...args, storeId: "store_999"})).rejects.toMatchObject({status: 404});
});
it("rejects missing session identity before database access", async () => {
  await expect(listCustomerAddresses({...args, userId: null})).rejects.toMatchObject({status: 401});
  expect(resolvePublishedStore).not.toHaveBeenCalled();
});
it("writes address only with derived store, org, and authenticated user", async () => {
  const tx={customerAddress: {count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({id:"addr_001"})}};
  (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
  await expect(createCustomerAddress({...args, input: row})).resolves.toEqual({ok:true,id:"addr_001"});
  expect(tx.customerAddress.create).toHaveBeenCalledWith({
    data: {organizationId:"org_001",storeId:"store_001",userId:"user_001", ...row, country:"US"},
    select:{id:true},
  });
});
it("never deletes an address by ID alone", async () => {
  (prisma.customerAddress.deleteMany as jest.Mock).mockResolvedValue({count:0});
  await expect(deleteCustomerAddress({...args,addressId:"addr_002"})).rejects.toMatchObject({status:404});
  expect(prisma.customerAddress.deleteMany).toHaveBeenCalledWith({where:{
    organizationId:"org_001",storeId:"store_001",userId:"user_001",id:"addr_002",
  }});
});
