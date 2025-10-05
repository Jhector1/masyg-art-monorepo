/**
 * @jest-environment node
 *
 * Extended coverage for src/app/api/cart/route.ts
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GET, POST, DELETE, PATCH } from "../route";

/* ── 1. MODULE-LEVEL MOCKS ────────────────────────────────────────── */

jest.mock("@prisma/client", () => {
  const stub = {
    cart: {
      findFirst: jest.fn(),
      create:    jest.fn(),
    },
    cartItem: {
      findFirst:  jest.fn(),
      findMany:   jest.fn(),
      findUnique: jest.fn(),
      create:     jest.fn(),
      deleteMany: jest.fn(),
      update:     jest.fn(),
      count:      jest.fn(),
      delete:     jest.fn(),
    },
    productVariant: {
      create:     jest.fn(),
      deleteMany: jest.fn(),
      update:     jest.fn(),
      delete:     jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => stub) };
});

jest.mock("cloudinary", () => ({ v2: { config: jest.fn() } }));

const getCustomerIdFromRequest = jest.fn();
jest.mock("@/utils/guest", () => ({
  getCustomerIdFromRequest: (...args: any[]) =>
    getCustomerIdFromRequest(...args),
}));

/* ── 2. SHARED STUBS & HELPERS ────────────────────────────────────── */

import { PrismaClient } from "@prisma/client";
const prismaMock = new PrismaClient() as any;

jest.spyOn(console, "log").mockImplementation(() => {}); // silence logs

const jsonSpy = jest
  .spyOn(NextResponse, "json")
  .mockImplementation((data: any, init: any = {}) =>
    ({ _body: data, status: init.status ?? 200 } as any)
  );

const fakeReq = (url: string, body?: any): NextRequest =>
  ({ url, json: body ? async () => body : undefined } as unknown as NextRequest);

const resetPrisma = () => {
  for (const group of Object.values(prismaMock))
    for (const fn of Object.values(group)) (fn as jest.Mock).mockReset();
};

/* ── 3. TESTS ─────────────────────────────────────────────────────── */

describe("API /api/cart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    getCustomerIdFromRequest.mockResolvedValue({ userId: "u1", guestId: null });
  });

  /* ───────── GET ───────── */

  describe("GET", () => {
    it("inCart=false when item missing", async () => {
      prismaMock.cart.findFirst.mockResolvedValue({ id: "c1" });
      prismaMock.cartItem.findFirst.mockResolvedValue(null);

      await GET(
        fakeReq(
          "https://x/api/cart?productId=px&digitalVariantId=dv&printVariantId="
        )
      );

      expect(jsonSpy).toHaveBeenCalledWith({ inCart: false });
    });
  });

  /* ───────── POST ──────── */

  describe("POST", () => {
    it("400s if price missing", async () => {
      await POST(fakeReq("https://x/api/cart", { productId: "p1" }));

      expect(jsonSpy).toHaveBeenCalledWith(
        { error: "Missing required fields." },
        { status: 400 }
      );
    });

    it("adds DIGITAL-only item when cart exists", async () => {
      prismaMock.cart.findFirst.mockResolvedValue({ id: "c222" });
      prismaMock.productVariant.create.mockResolvedValueOnce({
        id: "dv222",
        format: "jpg",
        license: "personal",
      });
      prismaMock.cartItem.create.mockResolvedValue({});

      await POST(
        fakeReq("https://x/api/cart", {
          productId: "p2",
          price: 15,
          digitalType: "JPG",
        })
      );

      expect(prismaMock.productVariant.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.cartItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cartId: "c222",
            digitalVariantId: "dv222",
          }),
        })
      );
    });
  });

  /* ───────── DELETE ────── */

  describe("DELETE", () => {
    it("handles item removed but no variants", async () => {
      prismaMock.cart.findFirst.mockResolvedValue({ id: "cDel" });
      prismaMock.cartItem.findMany.mockResolvedValue([
        { digitalVariantId: null, printVariantId: null },
      ]);

      await DELETE(fakeReq("https://x/api/cart", { productId: "pDel" }));

      expect(prismaMock.productVariant.deleteMany).not.toHaveBeenCalled();
      expect(jsonSpy).toHaveBeenCalledWith({
        message: "Removed 1 item(s) and 0 variant(s).",
      });
    });
  });

  /* ───────── PATCH ─────── */

  describe("PATCH", () => {
    const baseCart = {
      id: "cP",
      items: [
        {
          id: "ciP",
          productId: "pPatch",
          digitalVariantId: null,
          printVariantId: null,
        },
      ],
    };

    it("400s when updates.price is NaN", async () => {
      prismaMock.cart.findFirst.mockResolvedValue(baseCart);

      await PATCH(
        fakeReq("https://x/api/cart", {
          productId: "pPatch",
          digitalVariantId: "ADD",
          updates: { price: "oops" },
        })
      );

      expect(jsonSpy).toHaveBeenCalledWith(
        { error: "`updates.price` must be a valid number." },
        { status: 400 }
      );
    });

    it("ADDs digital variant then updates price", async () => {
      prismaMock.cart.findFirst.mockResolvedValue(baseCart);
      prismaMock.productVariant.create.mockResolvedValueOnce({
        id: "dvNEW",
        format: "jpg",
        license: "personal",
      });
      prismaMock.cartItem.update.mockResolvedValue({});
      prismaMock.cartItem.findUnique.mockResolvedValue({
        digitalVariantId: "dvNEW",
        printVariantId: null,
      });

      await PATCH(
        fakeReq("https://x/api/cart", {
          productId: "pPatch",
          digitalVariantId: "ADD",
          printVariantId: null,
          updates: { price: "33" },
        })
      );

      expect(prismaMock.productVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "pPatch",
            type: "DIGITAL",
          }),
        })
      );
      expect(jsonSpy).toHaveBeenCalledWith({
        message: "Cart item updated successfully.",
        price: 33,
      });
    });

    it("removes PRINT variant & deletes item if empty", async () => {
      prismaMock.cart.findFirst.mockResolvedValue({
        id: "c3",
        items: [
          {
            id: "ci3",
            productId: "p3",
            digitalVariantId: null,
            printVariantId: "pv3",
          },
        ],
      });
      prismaMock.cartItem.update.mockResolvedValue({});
      prismaMock.cartItem.count.mockResolvedValue(0);
      prismaMock.cartItem.findUnique.mockResolvedValue({
        digitalVariantId: null,
        printVariantId: null,
      });

      await PATCH(
        fakeReq("https://x/api/cart", {
          productId: "p3",
          digitalVariantId: null,
          printVariantId: "REMOVE",
          updates: { price: "0" },
        })
      );

      expect(prismaMock.cartItem.delete).toHaveBeenCalledWith({
        where: { id: "ci3" },
      });
      expect(jsonSpy).toHaveBeenCalledWith({
        message: "Cart item removed because both variants were removed.",
      });
    });
  });

  /* ───────── GUEST USER ───── */

  describe("guest user flows", () => {
    beforeEach(() =>
      getCustomerIdFromRequest.mockResolvedValue({
        userId: null,
        guestId: "guest-99",
      })
    );

    it("creates cart tied to guestId", async () => {
      prismaMock.cart.findFirst.mockResolvedValue(null);
      prismaMock.cart.create.mockResolvedValue({ id: "cg1" });
      prismaMock.productVariant.create.mockResolvedValueOnce({
        id: "dvG",
        format: "png",
        license: "personal",
      });
      prismaMock.cartItem.create.mockResolvedValue({});

      await POST(
        fakeReq("https://x/api/cart", {
          productId: "pG",
          price: 5,
          digitalType: "PNG",
        })
      );

      expect(prismaMock.cart.create).toHaveBeenCalledWith({
        data: { userId: null, guestId: "guest-99" },
      });
    });
  });
});
