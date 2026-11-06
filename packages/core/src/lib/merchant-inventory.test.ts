jest.mock("@acme/core/lib/prisma", () => ({ prisma: { $transaction: jest.fn(), inventoryLocation: { findMany: jest.fn() }, storeListing: { findMany: jest.fn() } } }));
jest.mock("./tenancy", () => ({
  requireMerchantAccess: jest.fn(), validateTenantId: (x: string) => x,
  TenantAccessError: class TenantAccessError extends Error { status = 404; },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { adjustMerchantStock, stockAdjustmentInput, listMerchantInventory } from "./merchant-inventory";
const db = prisma as jest.Mocked<typeof prisma>;
const body = { storeId: "store_001", variantId: "variant_001", locationId: "loc_001", delta: -3, reason: "Damaged item" };
function txMock(onHand: number, reserved: number) {
 return {
   productVariant: { findFirst: jest.fn().mockResolvedValue({ id: "variant_001", productId: "product_001" }) },
   inventoryLocation: { findFirst: jest.fn().mockResolvedValue({ id: "loc_001" }) },
   storeListing: { findUnique: jest.fn().mockResolvedValue({ storeId: "store_001" }) },
   inventoryLevel: { findUnique: jest.fn().mockResolvedValue({ onHand, reserved }), update: jest.fn().mockResolvedValue({ onHand: onHand-3, reserved }), create: jest.fn() },
   merchantAuditLog: { create: jest.fn() },
 };
}
beforeEach(() => { jest.clearAllMocks(); (requireMerchantAccess as jest.Mock).mockResolvedValue({ organizationId: "org_001", storeId: "store_001" }); });
it("rejects zero, fractional, oversized and unreasoned adjustments", () => {
 for(const value of [0, 0.5, 100001, -100001]) expect(stockAdjustmentInput.safeParse({ ...body, delta: value }).success).toBe(false);
 expect(stockAdjustmentInput.safeParse({ ...body, reason: "" }).success).toBe(false);
});
it("refuses to reduce on-hand below reserved without committing", async () => {
 const tx = txMock(5, 4); (db.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
 await expect(adjustMerchantStock({ userId: "user_001", organizationId: "org_001", body })).rejects.toMatchObject({ status: 409 });
 expect(tx.inventoryLevel.update).not.toHaveBeenCalled(); expect(tx.merchantAuditLog.create).not.toHaveBeenCalled();
});
it("valid adjustment is scoped and audited", async () => {
 const tx = txMock(10, 2); (db.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
 const result = await adjustMerchantStock({ userId: "user_001", organizationId: "org_001", body });
 expect(result).toEqual({ onHand: 7, reserved: 2, available: 5 });
 // Runtime-independent Prisma isolation level: production and Jest must use the same guarantee.
 expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
   isolationLevel: "Serializable", maxWait: 10000, timeout: 15000,
 }));
 expect(tx.productVariant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org_001", inventoryPolicy: "TRACKED" }) }));
 expect(tx.merchantAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "inventory.stock.adjusted", organizationId: "org_001" }) }));
});
it("retries only a P2034 transaction conflict, then commits the adjustment once", async () => {
 const tx = txMock(10, 2);
 const conflict = Object.assign(new Error("Serializable write conflict"), { code: "P2034" });
 (db.$transaction as jest.Mock)
   .mockRejectedValueOnce(conflict)
   .mockImplementationOnce(fn => fn(tx));
 const result = await adjustMerchantStock({ userId: "user_001", organizationId: "org_001", body });
 expect(result).toEqual({ onHand: 7, reserved: 2, available: 5 });
 expect(db.$transaction).toHaveBeenCalledTimes(2);
 expect(tx.inventoryLevel.update).toHaveBeenCalledTimes(1);
 expect(tx.merchantAuditLog.create).toHaveBeenCalledTimes(1);
});
it("stops after three P2034 conflicts with a safe 409 response", async () => {
 const conflict = Object.assign(new Error("Serialization conflict"), { code: "P2034" });
 (db.$transaction as jest.Mock).mockRejectedValue(conflict);
 await expect(adjustMerchantStock({ userId: "user_001", organizationId: "org_001", body }))
   .rejects.toMatchObject({ status: 409, message: "Concurrent stock adjustment; please retry" });
 expect(db.$transaction).toHaveBeenCalledTimes(3);
});
it("preserves unrelated database failures rather than retrying or masking them", async () => {
 const other = Object.assign(new Error("Database connection lost"), { code: "P1001" });
 (db.$transaction as jest.Mock).mockRejectedValue(other);
 await expect(adjustMerchantStock({ userId: "user_001", organizationId: "org_001", body })).rejects.toBe(other);
 expect(db.$transaction).toHaveBeenCalledTimes(1);
});
it("store inventory lookup requires authorized scoped storefront", async () => {
 (db.inventoryLocation.findMany as jest.Mock).mockResolvedValue([]); (db.storeListing.findMany as jest.Mock).mockResolvedValue([]);
 await listMerchantInventory({ userId: "user_001", organizationId: "org_001", storeId: "store_001" });
 expect(db.storeListing.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org_001", storeId: "store_001" } }));
});
