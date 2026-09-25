import { makeNextRequest } from "@acme/core/test/helpers/next";
import { POST } from "../route";
import { getPrincipalFromRequest, getOrCreateGuestId } from "@acme/auth";
import { prisma } from "@acme/core/lib/prisma";
import { stripe } from "@acme/core/lib/stripe";

jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@acme/auth", () => ({
  getPrincipalFromRequest: jest.fn(),
  getOrCreateGuestId: jest.fn(),
}));
jest.mock("@acme/core/lib/prisma", () => ({
  prisma: {
    cartItem: { findMany: jest.fn() },
    product: { findUnique: jest.fn() },
    productVariant: { findUnique: jest.fn() },
    order: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("@acme/core/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: jest.fn() } } },
}));
jest.mock("@acme/core/lib/pricing", () => ({
  getEffectiveSale: jest.fn(({ price }: any) => ({ price })),
  roundMoney: jest.fn((price: number) => price),
}));

const mockPrincipal = getPrincipalFromRequest as jest.Mock;
const mockGuest = getOrCreateGuestId as jest.Mock;
const mockPrisma = prisma as any;
const mockStripeCreate = stripe.checkout.sessions.create as jest.Mock;

const tx = {
  order: { create: jest.fn() },
  productVariant: { updateMany: jest.fn() },
  orderItem: { createMany: jest.fn() },
};

const request = (body: unknown) => makeNextRequest("https://jean.test/api/checkout", {
  method: "POST",
  body,
  headersObj: { "content-type": "application/json", origin: "https://jean.test" },
});

describe("JeanYves original-art checkout route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrincipal.mockResolvedValue({ userId: "u1" });
    mockGuest.mockReturnValue("g-created");
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1", title: "Original", thumbnails: ["https://cdn.test/p1.jpg"], site: "JEANYVES",
      price: 100, salePrice: null, salePercent: null, saleStartsAt: null, saleEndsAt: null,
    });
    mockPrisma.productVariant.findUnique.mockResolvedValue({
      id: "ov1", productId: "p1", type: "ORIGINAL", status: "ACTIVE", listPrice: 125,
      medium: null, year: null, widthIn: null, heightIn: null, originalSerial: "001",
    });
    tx.order.create.mockResolvedValue({ id: "ord1", site: "JEANYVES" });
    tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
    tx.orderItem.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    mockPrisma.order.update.mockResolvedValue({});
    mockStripeCreate.mockResolvedValue({ id: "cs1", url: "https://stripe.test/cs1" });
  });

  test("400 when cartProductList is missing", async () => {
    const res = await POST(request({}) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cartProductList/i);
  });

  test("creates and reserves an order for a direct ORIGINAL purchase", async () => {
    const res = await POST(request({ cartProductList: [{ productId: "p1", originalVariantId: "ov1" }] }) as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      flow: "redirect",
      url: "https://stripe.test/cs1",
      sessionId: "cs1",
      orderId: "ord1",
    });
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["ov1"] }, status: "ACTIVE" }) })
    );
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ orderId: "ord1", site: "JEANYVES", userId: "u1" }),
        line_items: [expect.objectContaining({ quantity: 1 })],
      })
    );
  });

  test("409 when the original loses the reservation race", async () => {
    tx.productVariant.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(request({ cartProductList: [{ productId: "p1", originalVariantId: "ov1" }] }) as any);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("original_unavailable");
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  test("generates a guest identity when no principal exists", async () => {
    mockPrincipal.mockResolvedValue({});
    mockGuest.mockReturnValue("g99");
    const res = await POST(request({ cartProductList: [{ productId: "p1", originalVariantId: "ov1" }] }) as any);
    expect(res.status).toBe(200);
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ guestId: "g99" }),
    }));
  });
});
