jest.mock("@acme/core/lib/prisma", () => ({
  prisma: {
    organizationMember: { findUnique: jest.fn() },
    storefront: { findFirst: jest.fn() },
    storeMember: { findUnique: jest.fn() },
    storeListing: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    product: { findFirst: jest.fn() },
  },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess, listMerchantProducts, listProductInStore, validateSlug, validateTenantId, TenantAccessError } from "./tenancy";
const db = prisma as jest.Mocked<typeof prisma>;
beforeEach(() => jest.clearAllMocks());

test("strict IDs and slugs", () => {
  expect(validateTenantId("store_001")).toBe("store_001");
  expect(() => validateTenantId("../foreign")).toThrow();
  expect(validateSlug("my-shop")).toBe("my-shop");
  expect(() => validateSlug("other shop")).toThrow();
});

test("no session fails before database access", async () => {
  await expect(requireMerchantAccess({ userId: null, organizationId: "org_001", capability: "read" }))
    .rejects.toMatchObject({ status: 401 });
  expect(db.organizationMember.findUnique).not.toHaveBeenCalled();
});

test("non member fails before catalog access", async () => {
  (db.organizationMember.findUnique as jest.Mock).mockResolvedValue(null);
  await expect(listMerchantProducts({ userId: "user_001", organizationId: "org_001", storeId: "store_001" }))
    .rejects.toMatchObject({ status: 404 });
  expect(db.storeListing.findMany).not.toHaveBeenCalled();
});

test("org member cannot access foreign store", async () => {
  (db.organizationMember.findUnique as jest.Mock).mockResolvedValue({ role: "OWNER" });
  (db.storefront.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(listMerchantProducts({ userId: "user_001", organizationId: "org_001", storeId: "store_other" }))
    .rejects.toMatchObject({ status: 404 });
  expect(db.storeListing.findMany).not.toHaveBeenCalled();
});

test("org MEMBER without store grant cannot read store data", async () => {
  (db.organizationMember.findUnique as jest.Mock).mockResolvedValue({ role: "MEMBER" });
  (db.storefront.findFirst as jest.Mock).mockResolvedValue({ id: "store_001" });
  (db.storeMember.findUnique as jest.Mock).mockResolvedValue(null);
  await expect(listMerchantProducts({ userId: "user_001", organizationId: "org_001", storeId: "store_001" }))
    .rejects.toMatchObject({ status: 404 });
});

test("store VIEWER grant cannot edit or publish", async () => {
  (db.organizationMember.findUnique as jest.Mock).mockResolvedValue({ role: "MEMBER" });
  (db.storefront.findFirst as jest.Mock).mockResolvedValue({ id: "store_001" });
  (db.storeMember.findUnique as jest.Mock).mockResolvedValue({ role: "VIEWER" });
  await expect(requireMerchantAccess({ userId: "user_001", organizationId: "org_001", storeId: "store_001", capability: "write" }))
    .rejects.toMatchObject({ status: 404 });
});

test("merchant product listing always queries StoreListing with organization and store", async () => {
  (db.organizationMember.findUnique as jest.Mock).mockResolvedValue({ role: "ADMIN" });
  (db.storefront.findFirst as jest.Mock).mockResolvedValue({ id: "store_001" });
  (db.storeListing.findMany as jest.Mock).mockResolvedValue([]);
  await listMerchantProducts({ userId: "user_001", organizationId: "org_001", storeId: "store_001", query: "painting" });
  expect((db.storeListing.findMany as jest.Mock).mock.calls[0][0].where)
    .toMatchObject({ organizationId: "org_001", storeId: "store_001" });
});

test("a foreign organization's product cannot be listed", async () => {
  (db.organizationMember.findUnique as jest.Mock).mockResolvedValue({ role: "OWNER" });
  (db.storefront.findFirst as jest.Mock).mockResolvedValue({ id: "store_001" });
  (db.product.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(listProductInStore({
    verifiedUserId: "user_001", organizationId: "org_001", storeId: "store_001",
    productId: "product_other", slug: "painting",
  })).rejects.toMatchObject({ status: 404 });
  expect(db.product.findFirst).toHaveBeenCalledWith({
    where: { id: "product_other", organizationId: "org_001" }, select: { id: true },
  });
  expect(db.storeListing.create).not.toHaveBeenCalled();
});

// The first merchant store must atomically claim a single owner slot.
test("self-service provisioning includes a unique owner claim within the organization transaction", async () => {
  const tx = {
    organization: { create: jest.fn().mockResolvedValue({ id: "org_new" }) },
    merchantOnboardingClaim: { create: jest.fn().mockResolvedValue({ userId: "user_001" }) },
    organizationMember: { create: jest.fn().mockResolvedValue({}) },
    storefront: { create: jest.fn().mockResolvedValue({ id: "store_new" }) },
  };
  (db as unknown as { $transaction: jest.Mock }).$transaction = jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  const { provisionMerchantStore } = await import("./tenancy");
  const result = await provisionMerchantStore({ verifiedUserId: "user_001", organizationName: "My Art", organizationSlug: "my-art", storeName: "Gallery", storeSlug: "gallery" });
  expect(result.store.id).toBe("store_new");
  expect(tx.merchantOnboardingClaim.create).toHaveBeenCalledWith({ data: { userId: "user_001", organizationId: "org_new" } });
  expect(tx.organizationMember.create).toHaveBeenCalledWith({ data: { userId: "user_001", organizationId: "org_new", role: "OWNER" } });
});


test("merchant MFA uses a typed precondition response without loosening tenant access", () => {
  const challenge = new TenantAccessError(428, "Second-factor verification required");
  expect(challenge).toMatchObject({
    name: "TenantAccessError",
    status: 428,
    message: "Second-factor verification required",
  });
  for (const status of [401, 403, 404] as const) {
    expect(new TenantAccessError(status).status).toBe(status);
  }
});
