jest.mock("@acme/core/lib/prisma", () => ({
  prisma: { $transaction: jest.fn(), guestPurchaseClaim: { updateMany: jest.fn() } },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requestGuestPurchaseClaim, redeemGuestPurchaseClaim } from "./guest-purchase-claim";
const db = prisma as unknown as { $transaction: jest.Mock; guestPurchaseClaim: { updateMany: jest.Mock } };
const now = new Date("2026-11-02T20:00:00.000Z");
const userId = "user_001", storeId = "store_001", orderId = "order_001", org = "org_001";
const delivered = jest.fn().mockResolvedValue(undefined);
function makeTx() {
  return {
    guestPurchaseClaim: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "claim_001" }),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: { findFirst: jest.fn().mockResolvedValue({ id: orderId, storeId,
      organizationId: org, customerId: "cust_001",
      customer: { email: "guest@example.com", userId: null } }) },
    customer: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}
function wire<T>(tx: T) { db.$transaction.mockImplementation((fn: (tx: T) => unknown) => fn(tx)); }
beforeEach(() => { jest.clearAllMocks(); delivered.mockResolvedValue(undefined); });
test("requires signed-in identity before touching the database", async () => {
  await expect(requestGuestPurchaseClaim({ userId: null, storeId, orderId, deliver: delivered, now }))
    .rejects.toMatchObject({ status: 401 });
  await expect(redeemGuestPurchaseClaim({ userId: null, code: "a".repeat(43), now }))
    .rejects.toMatchObject({ status: 401 });
  expect(db.$transaction).not.toHaveBeenCalled();
});
test("sends a 256-bit secret only to the paid order's saved customer mailbox", async () => {
  const tx = makeTx(); wire(tx);
  const result = await requestGuestPurchaseClaim({ userId, storeId, orderId, deliver: delivered, now });
  expect(result).toEqual({ accepted: true });
  expect(tx.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
    storeId, id: orderId, status: { in: ["PAID", "FULFILLING", "FULFILLED"] },
    customer: { is: { userId: null } },
  }) }));
  expect(delivered).toHaveBeenCalledWith({ to: "guest@example.com", code: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    expiresAt: new Date(now.getTime() + 600000) });
  const written = tx.guestPurchaseClaim.create.mock.calls[0][0].data;
  expect(written).toMatchObject({ organizationId: org, storeId, orderId, customerId: "cust_001", requesterUserId: userId });
  expect(written.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  expect(written.tokenHash).not.toBe(delivered.mock.calls[0][0].code);
  expect(JSON.stringify(result)).not.toContain("code");
});
test("unknown and already linked orders generate no mail and return indistinguishable responses", async () => {
  const tx = makeTx(); wire(tx);
  tx.order.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: orderId, organizationId: org,
    storeId, customerId: "cust_001", customer: { email: "guest@example.com", userId: "other_001" } });
  expect(await requestGuestPurchaseClaim({ userId, storeId, orderId, deliver: delivered, now })).toEqual({ accepted: true });
  expect(await requestGuestPurchaseClaim({ userId, storeId, orderId, deliver: delivered, now })).toEqual({ accepted: true });
  expect(delivered).not.toHaveBeenCalled();
  expect(tx.guestPurchaseClaim.create).not.toHaveBeenCalled();
});
test("database-backed per-account quota and per-order cooldown refuse challenge spam", async () => {
  const tx = makeTx(); wire(tx);
  tx.guestPurchaseClaim.count.mockResolvedValue(3);
  await requestGuestPurchaseClaim({ userId, storeId, orderId, deliver: delivered, now });
  expect(tx.order.findFirst).not.toHaveBeenCalled();
  tx.guestPurchaseClaim.count.mockResolvedValue(0);
  tx.guestPurchaseClaim.findFirst.mockResolvedValue({ id: "previous" });
  await requestGuestPurchaseClaim({ userId, storeId, orderId, deliver: delivered, now });
  expect(tx.guestPurchaseClaim.create).not.toHaveBeenCalled();
  expect(delivered).not.toHaveBeenCalled();
});
test("delivery error invalidates unsent secret rather than creating an accessible claim", async () => {
  const tx = makeTx(); wire(tx); delivered.mockRejectedValue(new Error("mailer offline"));
  expect(await requestGuestPurchaseClaim({ userId, storeId, orderId, deliver: delivered, now })).toEqual({ accepted: true });
  expect(db.guestPurchaseClaim.updateMany).toHaveBeenCalledWith({
    where: { id: "claim_001", consumedAt: null }, data: { consumedAt: now },
  });
});
test("redemption is single-use and links only the verified customer's organization row", async () => {
  const tx = makeTx(); wire(tx);
  const code = "x".repeat(43);
  const hash = require("node:crypto").createHash("sha256").update(code).digest("hex");
  tx.guestPurchaseClaim.findUnique.mockResolvedValue({ id: "claim_001", organizationId: org, storeId,
    orderId, customerId: "cust_001", requesterUserId: userId, consumedAt: null,
    expiresAt: new Date(now.getTime() + 10000) });
  tx.order.findFirst.mockResolvedValue({ id: orderId, customer: { id: "cust_001", userId: null } });
  expect(await redeemGuestPurchaseClaim({ userId, code, now })).toEqual({ claimed: true });
  expect(tx.guestPurchaseClaim.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hash } }));
  expect(tx.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
    id: orderId, organizationId: org, storeId, customerId: "cust_001", status: { in: ["PAID", "FULFILLING", "FULFILLED"] },
  } }));
  expect(tx.guestPurchaseClaim.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ id: "claim_001", requesterUserId: userId, consumedAt: null }),
  }));
  expect(tx.customer.updateMany).toHaveBeenCalledWith({ where: { id: "cust_001", organizationId: org, userId: null },
    data: { userId } });
});
test("wrong requester, expired, already-used or missing codes never link a customer", async () => {
  const tx = makeTx(); wire(tx); const code = "y".repeat(43);
  const original = { id: "claim_001", organizationId: org, storeId, orderId,
    customerId: "cust_001", requesterUserId: userId, consumedAt: null,
    expiresAt: new Date(now.getTime() + 10000) };
  for (const replacement of [null, { ...original, requesterUserId: "another_user" },
    { ...original, consumedAt: now }, { ...original, expiresAt: now }]) {
    tx.guestPurchaseClaim.findUnique.mockResolvedValue(replacement);
    await expect(redeemGuestPurchaseClaim({ userId, code, now })).rejects.toMatchObject({ status: 404 });
  }
  expect(tx.customer.updateMany).not.toHaveBeenCalled();
});
test("changed ownership, refunds, or a competing redemption cannot steal the order", async () => {
  const tx = makeTx(); wire(tx); const code = "z".repeat(43);
  tx.guestPurchaseClaim.findUnique.mockResolvedValue({ id: "claim_001", organizationId: org, storeId,
    orderId, customerId: "cust_001", requesterUserId: userId, consumedAt: null,
    expiresAt: new Date(now.getTime() + 10000) });
  tx.order.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({id:orderId,customer:{id:"cust_001",userId:"foreign"}})
    .mockResolvedValueOnce({id:orderId,customer:{id:"cust_001",userId:null}});
  await expect(redeemGuestPurchaseClaim({ userId, code, now })).rejects.toMatchObject({ status: 404 });
  await expect(redeemGuestPurchaseClaim({ userId, code, now })).rejects.toMatchObject({ status: 404 });
  tx.guestPurchaseClaim.updateMany.mockResolvedValue({ count: 0 });
  await expect(redeemGuestPurchaseClaim({ userId, code, now })).rejects.toMatchObject({ status: 404 });
  expect(tx.customer.updateMany).not.toHaveBeenCalled();
});


test("store-scoped redemption never consumes a code from another storefront", async () => {
  const tx = makeTx(); wire(tx); const code = "w".repeat(43);
  tx.guestPurchaseClaim.findUnique.mockResolvedValue({ id: "claim_001", organizationId: org,
    storeId, orderId, customerId: "cust_001", requesterUserId: userId, consumedAt: null,
    expiresAt: new Date(now.getTime() + 10000) });
  await expect(redeemGuestPurchaseClaim({ userId, storeId: "store_other", code, now }))
    .rejects.toMatchObject({ status: 404 });
  expect(tx.order.findFirst).not.toHaveBeenCalled();
  expect(tx.guestPurchaseClaim.updateMany).not.toHaveBeenCalled();
  expect(tx.customer.updateMany).not.toHaveBeenCalled();
  expect(await redeemGuestPurchaseClaim({ userId, storeId, code, now })).toEqual({ claimed: true });
});
