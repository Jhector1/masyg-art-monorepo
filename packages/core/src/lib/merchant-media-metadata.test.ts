jest.mock("@acme/core/lib/prisma", () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock("./tenancy", () => ({
  requireMerchantAccess: jest.fn(), validateTenantId: (x: string) => x,
  TenantAccessError: class TenantAccessError extends Error { status = 404; },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { cleanImageAlt, updateMerchantImageAlt, retireMerchantDigitalFile } from "./merchant-media-metadata";
const tx = () => ({
  productMedia: { findFirst: jest.fn().mockResolvedValue({ assetId: "asset_001" }), update: jest.fn() },
  digitalFile: { findFirst: jest.fn().mockResolvedValue({ id: "file_001" }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  merchantAuditLog: { create: jest.fn() },
});
beforeEach(() => { jest.clearAllMocks(); (requireMerchantAccess as jest.Mock).mockResolvedValue({ organizationId: "org_001" }); });
test("alt text accepts descriptive values and rejects invalid control chars or oversized text", () => {
  expect(cleanImageAlt("  Haitian painting  ")).toBe("Haitian painting");
  expect(() => cleanImageAlt("x".repeat(181))).toThrow(/180/);
  expect(() => cleanImageAlt("bad\nalt")).toThrow();
});
test("alt updates only an organization-scoped public product-media link", async () => {
  const t = tx(); (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(t));
  await updateMerchantImageAlt({ userId: "user_001", organizationId: "org_001", productId: "product_001", assetId: "asset_001", altText: "Acrylic portrait" });
  expect(t.productMedia.findFirst).toHaveBeenCalledWith({ where: {
    organizationId: "org_001", productId: "product_001", assetId: "asset_001",
    product: { status: { not: "ARCHIVED" } }, asset: { private: false },
  }, select: { assetId: true } });
  expect(t.productMedia.update).toHaveBeenCalledWith({ where: { organizationId_productId_assetId: { organizationId: "org_001", productId: "product_001", assetId: "asset_001" } }, data: { altText: "Acrylic portrait" } });
});
test("cannot update alt text when no scoped media match exists", async () => {
  const t = tx(); t.productMedia.findFirst.mockResolvedValue(null); (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(t));
  await expect(updateMerchantImageAlt({userId:"user_001",organizationId:"org_001",productId:"product_001",assetId:"other_001",altText:"foreign"})).rejects.toMatchObject({status:404});
  expect(t.productMedia.update).not.toHaveBeenCalled();
});
test("retirement does not delete purchase snapshots, grants, or Cloudinary bytes", async () => {
  const t = tx(); (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(t));
  await retireMerchantDigitalFile({userId:"user_001",organizationId:"org_001",productId:"product_001",digitalFileId:"file_001"});
  expect(t.digitalFile.findFirst).toHaveBeenCalledWith({ where: {
    id:"file_001",organizationId:"org_001",retiredAt:null,variant:{productId:"product_001",product:{status:{not:"ARCHIVED"}}},asset:{private:true},
  },select:{id:true} });
  expect(t.digitalFile.updateMany).toHaveBeenCalledWith({where:{id:"file_001",organizationId:"org_001",retiredAt:null},data:{retiredAt:expect.any(Date)}});
  expect(Object.keys(t)).toEqual(["productMedia","digitalFile","merchantAuditLog"]);
});

test("stale digital retirement rejects the second concurrent mutation", async () => {
  const t = tx(); t.digitalFile.updateMany.mockResolvedValue({ count: 0 });
  (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(t));
  await expect(retireMerchantDigitalFile({userId:"user_001", organizationId:"org_001",productId:"product_001", digitalFileId:"file_001"}))
    .rejects.toMatchObject({status:409});
  expect(t.merchantAuditLog.create).not.toHaveBeenCalled();
});
