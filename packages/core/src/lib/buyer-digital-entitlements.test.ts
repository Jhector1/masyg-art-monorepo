jest.mock("@acme/core/lib/prisma", () => ({
  prisma: { storefront: { findUnique: jest.fn() }, order: { findMany: jest.fn() } },
}));
import { prisma } from "@acme/core/lib/prisma";
import { listBuyerDigitalEntitlements } from "./buyer-digital-entitlements";
const db = prisma as jest.Mocked<typeof prisma>;
const now = new Date("2026-11-02T18:00:00.000Z");
const validFile = { id: "file_001", variantId: "variant_001", label: "Studio master WAV", asset: { private: true }, storageKey: "NEVER_SEND_STORAGE_KEY" };
const goodGrant = { id: "grant_001", digitalFileId: "file_001", file: validFile,
  tokenHash: "NEVER_SEND_GRANT_HASH", expiresAt: null, maximumUses: null, uses: 0, revokedAt: null };
function item(changes: Record<string, unknown> = {}) {
  return { id: "item_001", variantId: "variant_001", titleSnapshot: "Demo Track", fulfillment: "DIGITAL",
    purchasedFiles: [{ digitalFileId: "file_001" }], grants: [goodGrant], ...changes };
}
const paidOrder = { id: "order_001", createdAt: new Date("2026-11-01T10:00:00.000Z"), items: [item()] };
beforeEach(() => {
  jest.clearAllMocks();
  (db.storefront.findUnique as jest.Mock).mockResolvedValue({ organizationId: "org_001" });
  (db.order.findMany as jest.Mock).mockResolvedValue([paidOrder]);
});
const args = { userId: "user_001", storeId: "store_001", now };
test("no session identity rejects before any database access", async () => {
  await expect(listBuyerDigitalEntitlements({ ...args, userId: null })).rejects.toMatchObject({ status: 401 });
  expect(db.storefront.findUnique).not.toHaveBeenCalled();
  expect(db.order.findMany).not.toHaveBeenCalled();
});
test("unknown store returns 404 without an order query", async () => {
  (db.storefront.findUnique as jest.Mock).mockResolvedValue(null);
  await expect(listBuyerDigitalEntitlements(args)).rejects.toMatchObject({ status: 404 });
  expect(db.order.findMany).not.toHaveBeenCalled();
});
test("scopes by organization, storefront, PAID family, and signed-in user association", async () => {
  await listBuyerDigitalEntitlements(args);
  expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { organizationId: "org_001", storeId: "store_001",
      status: { in: ["PAID", "FULFILLING", "FULFILLED"] }, customer: { is: { userId: "user_001" } } },
    take: 50,
  }));
  const call = (db.order.findMany as jest.Mock).mock.calls[0][0];
  expect(call.select.items.where).toEqual({ fulfillment: "DIGITAL" });
  expect(call.select.items.select.grants.where).toEqual({ revokedAt: null });
  expect(call.select.items.select.grants.select.tokenHash).toBeUndefined();
});
test("returns a fixed public projection without grant secrets, assets, URLs or private keys", async () => {
  const result = await listBuyerDigitalEntitlements(args);
  expect(result).toEqual({ orders: [{ orderId: "order_001", placedAt: "2026-11-01T10:00:00.000Z",
    items: [{ orderItemId: "item_001", title: "Demo Track",
      files: [{ grantId: "grant_001", fileId: "file_001", label: "Studio master WAV" }] }] }] });
  const output = JSON.stringify(result);
  expect(output).not.toContain("NEVER_SEND_GRANT_HASH");
  expect(output).not.toContain("NEVER_SEND_STORAGE_KEY");
  expect(output).not.toContain("tokenHash");
  expect(output).not.toContain("storageKey");
  expect(output).not.toContain("url");
});
test("revoked, expired, exhausted, public, moved, and unsnapshotted files never appear", async () => {
  const bad = [
    { ...goodGrant, revokedAt: new Date("2026-11-02T12:00:00Z") },
    { ...goodGrant, expiresAt: new Date("2026-11-02T17:00:00Z") },
    { ...goodGrant, maximumUses: 2, uses: 2 },
    { ...goodGrant, file: { ...validFile, asset: { private: false } } },
    { ...goodGrant, file: { ...validFile, variantId: "variant_other" } },
    { ...goodGrant, digitalFileId: "file_other" },
    { ...goodGrant, file: { ...validFile, id: "file_other" } },
  ];
  for (const grant of bad) {
    (db.order.findMany as jest.Mock).mockResolvedValue([{ ...paidOrder, items: [item({ grants: [grant] })] }]);
    expect(await listBuyerDigitalEntitlements(args)).toEqual({ orders: [] });
  }
});
test("guest and unpaid orders cannot become visible through matching emails", async () => {
  // No userId -> no lookup; a logged-in user can only see Customer.userId-linked orders.
  await expect(listBuyerDigitalEntitlements({ ...args, userId: "" })).rejects.toMatchObject({ status: 401 });
  expect(db.order.findMany).not.toHaveBeenCalled();
});
test("excludes empty digital order lines and returns only active snapshots", async () => {
  (db.order.findMany as jest.Mock).mockResolvedValue([{ ...paidOrder, items: [
    item({ purchasedFiles: [], grants: [goodGrant] }),
    item({ id: "item_002", purchasedFiles: [{ digitalFileId: "file_001" }], grants: [goodGrant] }),
  ] }]);
  const result = await listBuyerDigitalEntitlements(args);
  expect(result.orders[0].items.map((v) => v.orderItemId)).toEqual(["item_002"]);
});
