jest.mock("@acme/core/lib/prisma", () => ({ prisma: {
  product: { updateMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  productVariant: { updateMany: jest.fn(), findUnique: jest.fn() },
  storeListing: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
} }));
jest.mock("./tenancy", () => ({
  requireMerchantAccess: jest.fn(),
  validateTenantId: (v: string) => v,
  TenantAccessError: class TenantAccessError extends Error { status = 404; },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { archiveCatalogProduct, updateCatalogProduct, publishCatalogProduct, setStoreListingStatus } from "./catalog-lifecycle";
const db = prisma as jest.Mocked<typeof prisma>;
const access = requireMerchantAccess as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  access.mockResolvedValue({ organizationId: "org_001", storeId: "store_001" });
});

test("product update always filters by merchant organization and product", async () => {
  (db.product.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  await updateCatalogProduct({ userId: "user_001", organizationId: "org_001", productId: "product_001", changes: { title: "New title" } });
  expect(db.product.updateMany).toHaveBeenCalledWith({
    where: { organizationId: "org_001", id: "product_001", status: { not: "ARCHIVED" } },
    data: { title: "New title" },
  });
});
test("no matching product never becomes an unscoped update", async () => {
  (db.product.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  await expect(updateCatalogProduct({ userId: "user_001", organizationId: "org_001", productId: "foreign_001", changes: { title: "New title" } })).rejects.toMatchObject({ status: 404 });
  expect(db.product.findUnique).not.toHaveBeenCalled();
});
test("archive retains order history and archives only scoped listings", async () => {
  (db.$transaction as jest.Mock).mockImplementation((fn) => fn({
    product: { findFirst: jest.fn().mockResolvedValue({ id: "product_001" }), update: jest.fn() },
    storeListing: { updateMany: jest.fn().mockImplementation((query) => {
      expect(query.where).toEqual({ organizationId: "org_001", productId: "product_001" });
    }) },
    merchantAuditLog: { create: jest.fn() },
  }));
  await expect(archiveCatalogProduct({ userId: "user_001", organizationId: "org_001", productId: "product_001" })).resolves.toEqual({ archived: true, productId: "product_001" });
});
test("digital variants require an attached file before publication", async () => {
  (db.product.findFirst as jest.Mock).mockResolvedValue({ variants: [{ active: true, fulfillment: "DIGITAL", priceMinor: 1000, digitalFiles: [] }] });
  await expect(publishCatalogProduct({ userId: "user_001", organizationId: "org_001", productId: "product_001" })).rejects.toThrow(/private files/);
  expect(db.product.updateMany).not.toHaveBeenCalled();
});
test("store listing cannot be published before catalog product", async () => {
  (db.storeListing.findUnique as jest.Mock).mockResolvedValue({ product: { status: "DRAFT" } });
  await expect(setStoreListingStatus({ userId: "user_001", organizationId: "org_001", storeId: "store_001", productId: "product_001", status: "PUBLISHED" })).rejects.toThrow(/catalog product/);
  expect(db.storeListing.updateMany).not.toHaveBeenCalled();
});
test("listing update references exact organization, store and product", async () => {
  (db.storeListing.findUnique as jest.Mock).mockResolvedValue({ product: { status: "PUBLISHED" } });
  (db.storeListing.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  await setStoreListingStatus({ userId: "user_001", organizationId: "org_001", storeId: "store_001", productId: "product_001", status: "PUBLISHED" });
  expect(db.storeListing.updateMany).toHaveBeenCalledWith({
    where: { organizationId: "org_001", storeId: "store_001", productId: "product_001", product: { status: "PUBLISHED" } },
    data: { status: "PUBLISHED" },
  });
});
