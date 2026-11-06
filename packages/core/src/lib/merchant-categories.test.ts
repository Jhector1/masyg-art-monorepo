jest.mock("@acme/core/lib/prisma", () => ({ prisma: {
  $transaction: jest.fn(), category: { findMany: jest.fn(), count: jest.fn() },
} }));
jest.mock("./tenancy", () => ({
  requireMerchantAccess: jest.fn(), validateTenantId: (x: string) => x,
  validateSlug: (x: string) => x,
  TenantAccessError: class TenantAccessError extends Error { status = 404; },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { categoryIdsInput, setMerchantProductCategories } from "./merchant-categories";
const db = prisma as jest.Mocked<typeof prisma>;
beforeEach(() => {
  jest.clearAllMocks();
  (requireMerchantAccess as jest.Mock).mockResolvedValue({ organizationId: "org_001" });
});
it("rejects duplicate category assignments before any database query", async () => {
  await expect(setMerchantProductCategories({ userId: "user_001", organizationId: "org_001", productId: "product_001", body: { categoryIds: ["cat_001","cat_001"] } })).rejects.toThrow();
  expect(db.$transaction).not.toHaveBeenCalled();
});
it("strictly rejects unexpected request keys", () => {
  expect(categoryIdsInput.safeParse({ categoryIds: [], organizationId: "other" }).success).toBe(false);
});
it("does not delete existing assignments when a foreign category is supplied", async () => {
  const tx = { product: { findFirst: jest.fn().mockResolvedValue({ id: "product_001" }) },
    category: { count: jest.fn().mockResolvedValue(0) },
    productCategory: { deleteMany: jest.fn(), createMany: jest.fn() }, merchantAuditLog: { create: jest.fn() } };
  (db.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
  await expect(setMerchantProductCategories({ userId: "user_001", organizationId: "org_001", productId: "product_001", body: { categoryIds: ["cat_other"] } })).rejects.toMatchObject({ status: 404 });
  expect(tx.category.count).toHaveBeenCalledWith({ where: { organizationId: "org_001", id: { in: ["cat_other"] } } });
  expect(tx.productCategory.deleteMany).not.toHaveBeenCalled();
});
it("scopes product category assignments and audit to the organization", async () => {
  const tx = { product: { findFirst: jest.fn().mockResolvedValue({ id: "product_001" }) },
    category: { count: jest.fn().mockResolvedValue(1) },
    productCategory: { deleteMany: jest.fn(), createMany: jest.fn() }, merchantAuditLog: { create: jest.fn() } };
  (db.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
  const result = await setMerchantProductCategories({ userId: "user_001", organizationId: "org_001", productId: "product_001", body: { categoryIds: ["cat_001"] } });
  expect(result.categoryIds).toEqual(["cat_001"]);
  expect(tx.productCategory.deleteMany).toHaveBeenCalledWith({ where: { organizationId: "org_001", productId: "product_001" } });
  expect(tx.productCategory.createMany).toHaveBeenCalledWith({ data: [{ organizationId: "org_001", productId: "product_001", categoryId: "cat_001" }] });
});
