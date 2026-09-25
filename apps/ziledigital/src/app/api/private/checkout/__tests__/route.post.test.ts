import { makeNextRequest } from "@acme/core/test/helpers/next";
import { POST } from "../route";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { prisma } from "@acme/core/lib/prisma";
import { stripe } from "@acme/core/lib/stripe";

jest.mock("@acme/core/utils/guest", () => ({ getCustomerIdFromRequest: jest.fn() }));
jest.mock("@acme/core/lib/prisma", () => ({
  prisma: { cartItem: { findMany: jest.fn() } },
}));
jest.mock("@acme/core/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: jest.fn() } } },
}));
jest.mock("@acme/core/lib/pricing", () => ({
  computeBaseUnit: jest.fn(() => 12),
  getEffectiveSale: jest.fn(({ price }: any) => ({ price })),
  applyBundleIfBoth: jest.fn((price: number) => price),
  roundMoney: jest.fn((price: number) => price),
}));

const mockIdentity = getCustomerIdFromRequest as jest.Mock;
const mockFindMany = (prisma as any).cartItem.findMany as jest.Mock;
const mockCreate = stripe.checkout.sessions.create as jest.Mock;

const req = (body: unknown) => makeNextRequest("http://localhost/api/private/checkout", {
  method: "POST",
  body,
  headersObj: { "content-type": "application/json" },
});

const digitalCartItem = {
  id: "ci1",
  productId: "p1",
  product: {
    id: "p1",
    title: "Artwork",
    price: 12,
    thumbnails: ["https://cdn.test/p1.jpg"],
    salePrice: null,
    salePercent: null,
    saleStartsAt: null,
    saleEndsAt: null,
    sizes: [],
  },
  digitalVariant: { id: "dv1", format: "png", license: "personal" },
  printVariant: null,
  design: null,
  styleSnapshot: null,
  previewUrlSnapshot: null,
};

describe("ZileDigital checkout route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CLIENT_URL = "https://zile.test";
    mockIdentity.mockResolvedValue({ userId: "u1" });
  });

  test("401 without an actor", async () => {
    mockIdentity.mockResolvedValue({});
    const res = await POST(req({ cartProductList: [] }) as any);
    expect(res.status).toBe(401);
  });

  test("400 when cartProductList is missing", async () => {
    const res = await POST(req({}) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cartProductList/i);
  });

  test("404 when requested cart item is not owned", async () => {
    mockFindMany.mockResolvedValue([]);
    const res = await POST(req({ cartProductList: [{ cartItemId: "ci1" }] }) as any);
    expect(res.status).toBe(404);
  });

  test("creates redirect Stripe session from server-owned cart data", async () => {
    mockFindMany.mockResolvedValue([digitalCartItem]);
    mockCreate.mockResolvedValue({ id: "cs1", url: "https://stripe.test/cs1" });

    const res = await POST(req({ cartProductList: [{ cartItemId: "ci1", quantity: 1 }] }) as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ flow: "redirect", url: "https://stripe.test/cs1", sessionId: "cs1" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: expect.objectContaining({ userId: "u1", cartItemIds: "ci1" }),
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 1200,
              product_data: expect.objectContaining({
                metadata: expect.objectContaining({
                  productId: "p1",
                  cartItemId: "ci1",
                  variantType: "DIGITAL",
                  digitalVariantId: "dv1",
                }),
              }),
            }),
          }),
        ],
      }),
      { idempotencyKey: "checkout:u1:ci1" }
    );
  });

  test("returns 500 when Stripe session creation fails", async () => {
    mockFindMany.mockResolvedValue([digitalCartItem]);
    mockCreate.mockRejectedValue(new Error("Stripe unavailable"));
    const res = await POST(req({ cartProductList: [{ cartItemId: "ci1" }] }) as any);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("checkout_failed");
  });
});
