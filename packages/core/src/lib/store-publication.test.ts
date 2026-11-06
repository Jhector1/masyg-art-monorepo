jest.mock("@acme/core/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));
jest.mock("./tenancy", () => ({
  requireMerchantAccess: jest.fn(),
  TenantAccessError: class TenantAccessError extends Error { status=404; },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { setMerchantStorePublished } from "./store-publication";
const db = prisma as jest.Mocked<typeof prisma>;
const access = requireMerchantAccess as jest.Mock;
const tx = {
  storeListing: { findFirst: jest.fn() },
  storefront: { updateMany: jest.fn(), findFirst: jest.fn() },
  merchantAuditLog: { create: jest.fn() },
};
beforeEach(() => {
  jest.clearAllMocks();
  access.mockResolvedValue({ organizationId: "org_001", storeId: "store_001" });
  (db.$transaction as jest.Mock).mockImplementation(async callback => callback(tx));
});

test("refuses publishing a storefront with no published listing", async () => {
  (tx.storeListing.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(setMerchantStorePublished({ userId: "user_001", organizationId: "org_001", storeId: "store_001", published: true }))
    .rejects.toThrow(/Publish a catalog product/);
  expect(tx.storefront.updateMany).not.toHaveBeenCalled();
});
test("publish requires org/store manage and scopes mutations", async () => {
  (tx.storeListing.findFirst as jest.Mock).mockResolvedValue({ productId: "product_001" });
  (tx.storefront.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  await setMerchantStorePublished({ userId: "user_001", organizationId: "org_001", storeId: "store_001", published: true });
  expect(access).toHaveBeenCalledWith({ userId: "user_001", organizationId: "org_001", capability: "manage" });
  expect(access).toHaveBeenCalledWith({ userId: "user_001", organizationId: "org_001", storeId: "store_001", capability: "manage" });
  expect(tx.storefront.updateMany).toHaveBeenCalledWith({
    where: { organizationId: "org_001", id: "store_001" }, data: { published: true },
  });
  expect((tx.storeListing.findFirst as jest.Mock).mock.calls[0][0].where).toMatchObject({ organizationId: "org_001", storeId: "store_001", status: "PUBLISHED" });
});
test("unpublish needs no listing but still enforces ownership scope", async () => {
  (tx.storefront.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  await setMerchantStorePublished({ userId: "user_001", organizationId: "org_001", storeId: "store_001", published: false });
  expect(tx.storeListing.findFirst).not.toHaveBeenCalled();
  expect(tx.storefront.updateMany).toHaveBeenCalledWith({ where: { organizationId: "org_001", id: "store_001" }, data: { published: false } });
});
test("cross-tenant failure cannot publish", async () => {
  access.mockRejectedValue(new Error("not a member"));
  await expect(setMerchantStorePublished({ userId: "foreign_001", organizationId: "org_001", storeId: "store_001", published: true }))
    .rejects.toThrow("not a member");
  expect(tx.storefront.updateMany).not.toHaveBeenCalled();
});
