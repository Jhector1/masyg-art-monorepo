jest.mock("@acme/core/lib/prisma", () => ({ prisma: {
  organizationMember: { findUnique: jest.fn() },
  storefront: { findFirst: jest.fn() },
  $transaction: jest.fn(),
} }));
import { prisma } from "@acme/core/lib/prisma";
import { createMerchantProduct } from "./tenancy";
import { catalogCreateInput, storeCatalogCreateInput } from "./catalog-contract";

const db = prisma as jest.Mocked<typeof prisma>;
const tx = {
  product: { create: jest.fn() },
  productVariant: { createMany: jest.fn() },
  storeListing: { create: jest.fn() },
  merchantAuditLog: { create: jest.fn() },
};
const params = {
  verifiedUserId: "user_001", organizationId: "org_001", storeId: "store_001",
  listingSlug: "art", title: "Art", variants: [
    { name: "Standard", fulfillment: "PHYSICAL" as const, priceMinor: 2500, currency: "USD" },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  (db.organizationMember.findUnique as jest.Mock).mockResolvedValue({ role: "OWNER" });
  (db.storefront.findFirst as jest.Mock).mockResolvedValue({ id: "store_001" });
  (db.$transaction as jest.Mock).mockImplementation(async callback => callback(tx));
  tx.product.create.mockResolvedValue({ id: "product_001" });
});

test("store create validation requires valid slug and a real variant", () => {
  const valid = { ...params, slug: "art" };
  const { title, slug, variants } = valid;
  expect(storeCatalogCreateInput.parse({ title, slug, variants }).slug).toBe("art");
  expect(() => storeCatalogCreateInput.parse({ title, slug: "../foreign", variants })).toThrow();
  expect(() => storeCatalogCreateInput.parse({ title, slug, variants: [] })).toThrow();
  expect(() => catalogCreateInput.parse({ title, slug, variants })).toThrow();
});

test("authorized merchant creates product, variant, listing and audit in one transaction", async () => {
  await createMerchantProduct(params);
  expect(db.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.product.create).toHaveBeenCalledWith({ data: {
    organizationId: "org_001", title: "Art", description: "", offersDigitalLicenses:false, offersFraming:false, offersGlazing:false,
  } });
  expect(tx.productVariant.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
    organizationId: "org_001", productId: "product_001", priceMinor: 2500,
    inventoryPolicy: "TRACKED", currency: "USD",
  })] });
  expect(tx.storeListing.create).toHaveBeenCalledWith({ data: {
    organizationId: "org_001", storeId: "store_001", productId: "product_001",
    slug: "art", status: "DRAFT",
  } });
  expect(tx.merchantAuditLog.create).toHaveBeenCalledTimes(1);
});

test("foreign store cannot start the product transaction", async () => {
  (db.storefront.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(createMerchantProduct(params)).rejects.toMatchObject({ status: 404 });
  expect(db.$transaction).not.toHaveBeenCalled();
});
