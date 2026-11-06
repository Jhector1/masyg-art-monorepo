/** @jest-environment node */
/**
 * V19 acceptance: actual PostgreSQL transactions and database constraints.
 * Ordinary unit test runs skip this file. Only the disposable-Docker runner
 * enables it with ZILEDIGITAL_ACCEPTANCE_RUN=YES.
 */
// Jest finds a legacy manual @prisma/client mock in src/__mocks__. This is an
// actual PostgreSQL acceptance suite, so explicitly opt out before imports are
// evaluated. SWC/Jest hoists these calls ahead of the transformed imports.
jest.unmock("@prisma/client");
jest.unmock("@acme/db");
jest.unmock("@acme/core/lib/prisma");

import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@acme/core/lib/prisma";
import { requestGuestPurchaseClaim, redeemGuestPurchaseClaim } from "./guest-purchase-claim";
import { listCustomerOrders } from "./customer-orders";

const enabled = process.env.ZILEDIGITAL_ACCEPTANCE_RUN === "YES";
const suite = enabled ? describe : describe.skip;
const random = () => randomBytes(8).toString("hex");

async function seed(status: "PAID" | "CANCELLED" = "PAID") {
  const suffix = random();
  const user = await prisma.user.create({ data: {
    email: `claim-requester-${suffix}@example.test`, name: "Acceptance Buyer",
  } });
  const organization = await prisma.organization.create({ data: {
    slug: `claim-merchant-${suffix}`, name: `Acceptance Merchant ${suffix}`,
  } });
  const store = await prisma.storefront.create({ data: {
    organizationId: organization.id, slug: "shop", name: "Shop",
  } });
  const customer = await prisma.customer.create({ data: {
    organizationId: organization.id, email: `checkout-${suffix}@example.test`,
  } });
  const order = await prisma.order.create({ data: {
    organizationId: organization.id, storeId: store.id, customerId: customer.id,
    status, currency: "USD", subtotalMinor: 1200, totalMinor: 1200,
  } });
  return { user, organization, store, customer, order };
}

suite("real PostgreSQL guest-claim acceptance (disposable database ONLY)", () => {
  beforeAll(() => {
    // Catch an unexpected mock before any seed writes, with a useful failure.
    if (typeof prisma?.user?.create !== "function" ||
        typeof prisma?.guestPurchaseClaim?.create !== "function" ||
        typeof prisma?.$transaction !== "function") {
      throw new Error("REFUSED: acceptance suite must use the real generated Prisma Client, not src/__mocks__/@prisma/client");
    }
    const url = process.env.DATABASE_URL ?? "";
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error("Acceptance DB URL missing"); }
    if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" ||
        !parsed.pathname.startsWith("/ziledigital_acceptance_")) {
      throw new Error("REFUSED: acceptance must use a local disposable PostgreSQL database");
    }
  });
  afterAll(async () => { await prisma.$disconnect(); });

  test("real one-time claim links only after mailbox proof; replays cannot relink", async () => {
    const s = await seed();
    const mailed: Array<{ to: string; code: string; expiresAt: Date }> = [];
    expect(await requestGuestPurchaseClaim({ userId: s.user.id, storeId: s.store.id,
      orderId: s.order.id, deliver: async m => { mailed.push(m); } }))
      .toEqual({ accepted: true });
    expect(mailed).toHaveLength(1);
    expect(mailed[0].to).toBe(s.customer.email);
    expect(mailed[0].code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await prisma.guestPurchaseClaim.findFirstOrThrow({
      where: { orderId: s.order.id },
    });
    expect(stored.tokenHash).toBe(createHash("sha256").update(mailed[0].code).digest("hex"));
    expect(JSON.stringify(stored)).not.toContain(mailed[0].code);
    expect((await listCustomerOrders({ userId: s.user.id, storeId: s.store.id })).orders).toHaveLength(0);
    expect(await redeemGuestPurchaseClaim({ userId: s.user.id, code: mailed[0].code })).toEqual({ claimed: true });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: s.customer.id } })).userId).toBe(s.user.id);
    expect((await listCustomerOrders({ userId: s.user.id, storeId: s.store.id })).orders.map(o => o.id))
      .toContain(s.order.id);
    await expect(redeemGuestPurchaseClaim({ userId: s.user.id, code: mailed[0].code }))
      .rejects.toMatchObject({ status: 404 });
  });

  test("different merchant/store and wrong requester never gain access", async () => {
    const a = await seed();
    const b = await seed();
    const messages: Array<{ to: string; code: string }> = [];
    const deliver = async (m: { to: string; code: string }) => { messages.push(m); };
    expect(await requestGuestPurchaseClaim({ userId: a.user.id, storeId: b.store.id,
      orderId: a.order.id, deliver })).toEqual({ accepted: true });
    expect(messages).toHaveLength(0);
    expect(await requestGuestPurchaseClaim({ userId: a.user.id, storeId: a.store.id,
      orderId: a.order.id, deliver })).toEqual({ accepted: true });
    expect(messages).toHaveLength(1);
    await expect(redeemGuestPurchaseClaim({ userId: b.user.id, code: messages[0].code }))
      .rejects.toMatchObject({ status: 404 });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: a.customer.id } })).userId).toBeNull();
    expect((await listCustomerOrders({ userId: b.user.id, storeId: a.store.id })).orders).toHaveLength(0);
  });

  test("cross-store redemption cannot consume a valid claim code", async () => {
    const a = await seed(); const b = await seed(); let code = "";
    await requestGuestPurchaseClaim({ userId: a.user.id, storeId: a.store.id,
      orderId: a.order.id, deliver: async m => { code = m.code; } });
    expect(code).toHaveLength(43);
    await expect(redeemGuestPurchaseClaim({ userId: a.user.id, storeId: b.store.id, code }))
      .rejects.toMatchObject({ status: 404 });
    expect((await prisma.guestPurchaseClaim.findFirstOrThrow({ where: { orderId: a.order.id } })).consumedAt)
      .toBeNull();
    expect(await redeemGuestPurchaseClaim({ userId: a.user.id, storeId: a.store.id, code }))
      .toEqual({ claimed: true });
  });

  test("refunded/cancelled orders cannot mint new claims, or redeem old ones", async () => {
    const s = await seed("CANCELLED");
    const mailed: string[] = [];
    await requestGuestPurchaseClaim({ userId: s.user.id, storeId: s.store.id,
      orderId: s.order.id, deliver: async m => { mailed.push(m.code); } });
    expect(mailed).toHaveLength(0);
    await prisma.order.update({ where: { id: s.order.id }, data: { status: "PAID" } });
    await requestGuestPurchaseClaim({ userId: s.user.id, storeId: s.store.id,
      orderId: s.order.id, deliver: async m => { mailed.push(m.code); } });
    expect(mailed).toHaveLength(1);
    await prisma.order.update({ where: { id: s.order.id }, data: { status: "REFUNDED" } });
    await expect(redeemGuestPurchaseClaim({ userId: s.user.id, code: mailed[0] }))
      .rejects.toMatchObject({ status: 404 });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: s.customer.id } })).userId).toBeNull();
  });

  test("expired codes stay invalid even with a real database row", async () => {
    const s = await seed();
    let code = ""; let expiry = new Date();
    await requestGuestPurchaseClaim({ userId: s.user.id, storeId: s.store.id,
      orderId: s.order.id, deliver: async m => { code = m.code; expiry = m.expiresAt; } });
    expect(code.length).toBe(43);
    await expect(redeemGuestPurchaseClaim({ userId: s.user.id, code,
      now: new Date(expiry.getTime() + 1) })).rejects.toMatchObject({ status: 404 });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: s.customer.id } })).userId).toBeNull();
  });

  test("concurrent redemption under serializable isolation succeeds exactly once", async () => {
    const s = await seed(); let code = "";
    await requestGuestPurchaseClaim({ userId: s.user.id, storeId: s.store.id,
      orderId: s.order.id, deliver: async m => { code = m.code; } });
    expect(code.length).toBe(43);
    const results = await Promise.allSettled([
      redeemGuestPurchaseClaim({ userId: s.user.id, code }),
      redeemGuestPurchaseClaim({ userId: s.user.id, code }),
    ]);
    // A database timeout/conflict is not a valid duplicate-claim rejection.
    // The losing contender must finish as an explicit invalid/consumed claim.
    const fulfilled = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status !== "rejected") {
      throw new Error("Expected one rejected duplicate redemption");
    }
    expect(rejected[0].reason).toMatchObject({ status: 404 });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: s.customer.id } })).userId).toBe(s.user.id);
    expect((await prisma.guestPurchaseClaim.findFirstOrThrow({ where: { orderId: s.order.id } })).consumedAt)
      .not.toBeNull();
  }, 60_000); // Real PostgreSQL can legitimately wait/retry beyond Jest's 5s default.

  test("database composite foreign key rejects mixing another merchant's order", async () => {
    const a = await seed(); const b = await seed();
    await expect(prisma.guestPurchaseClaim.create({ data: {
      organizationId: a.organization.id, storeId: a.store.id,
      orderId: b.order.id, customerId: a.customer.id,
      requesterUserId: a.user.id,
      tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    } })).rejects.toMatchObject({ code: "P2003" });
  });

  test("database-backed per-requester throttle applies across different orders", async () => {
    const s = await seed(); let sent = 0;
    for (let index = 0; index < 4; index++) {
      const order = index === 0 ? s.order : await prisma.order.create({ data: {
        organizationId: s.organization.id, storeId: s.store.id, customerId: s.customer.id,
        status: "PAID", currency: "USD", subtotalMinor: 100, totalMinor: 100,
      } });
      await requestGuestPurchaseClaim({ userId: s.user.id, storeId: s.store.id,
        orderId: order.id, deliver: async () => { sent += 1; } });
    }
    expect(sent).toBe(3);
  });
});
