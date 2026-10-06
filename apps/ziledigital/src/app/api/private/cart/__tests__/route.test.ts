import { makeNextRequest } from "@acme/core/test/helpers/next";
import { GET, POST, PATCH, DELETE } from "../route";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import {
  getCart,
  isInCart,
  addToCart,
  patchCart,
  deleteFromCart,
  isCartOwnerMissingError,
} from "@acme/server/cart/cart.service";

jest.mock("@acme/core/utils/guest", () => ({ getCustomerIdFromRequest: jest.fn() }));
jest.mock("@acme/server/cart/cart.service", () => ({
  getCart: jest.fn(),
  isInCart: jest.fn(),
  addToCart: jest.fn(),
  patchCart: jest.fn(),
  deleteFromCart: jest.fn(),
  isCartOwnerMissingError: jest.fn(),
}));

const mockIdentity = getCustomerIdFromRequest as jest.Mock;
const mockGetCart = getCart as jest.Mock;
const mockIsInCart = isInCart as jest.Mock;
const mockAdd = addToCart as jest.Mock;
const mockPatch = patchCart as jest.Mock;
const mockDelete = deleteFromCart as jest.Mock;
const mockIsOwnerMissing = isCartOwnerMissingError as unknown as jest.Mock;

const request = (url: string, body?: unknown, method = "POST") =>
  makeNextRequest(url, {
    method: body === undefined ? "GET" : method,
    body,
    headersObj: body === undefined ? undefined : { "content-type": "application/json" },
  });

describe("ZileDigital cart route boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIdentity.mockResolvedValue({ userId: "u1" });
    mockIsOwnerMissing.mockReturnValue(false);
  });

  test("GET probe resolves ZILEDIGITAL and delegates to shared service", async () => {
    mockIsInCart.mockResolvedValue({ inCart: false });
    const res = await GET(request("https://x/api/private/cart?productId=p1&digitalVariantId=d1") as any);
    expect(await res.json()).toEqual({ inCart: false });
    expect(mockIsInCart).toHaveBeenCalledWith(
      "ZILEDIGITAL",
      { userId: "u1", guestId: undefined },
      { productId: "p1", digitalVariantId: "d1", printVariantId: null, originalVariantId: null }
    );
  });

  test("GET list delegates to shared service", async () => {
    mockGetCart.mockResolvedValue([]);
    const res = await GET(request("https://x/api/private/cart") as any);
    expect(await res.json()).toEqual([]);
    expect(mockGetCart).toHaveBeenCalledWith("ZILEDIGITAL", { userId: "u1", guestId: undefined }, { live: false });
  });

  test("POST rejects malformed payload before service call", async () => {
    const res = await POST(request("https://x/api/private/cart", { productId: "p1" }) as any);
    expect(res.status).toBe(400);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  test("POST validates then delegates a digital item", async () => {
    const body = {
      productId: "p1",
      digitalType: "PNG",
      format: "png",
      license: "personal",
      quantity: 1,
    };
    mockAdd.mockResolvedValue({ message: "added" });
    const res = await POST(request("https://x/api/private/cart", body) as any);
    expect(res.status).toBe(200);
    expect(mockAdd).toHaveBeenCalledWith("ZILEDIGITAL", { userId: "u1", guestId: undefined }, body);
  });

  test("PATCH validates then delegates", async () => {
    const body = { productId: "p1", digitalVariantId: "d1", updates: { price: 33 } };
    mockPatch.mockResolvedValue({ message: "updated" });
    const res = await PATCH(request("https://x/api/private/cart", body, "PATCH") as any);
    expect(res.status).toBe(200);
    expect(mockPatch).toHaveBeenCalledWith("ZILEDIGITAL", { userId: "u1", guestId: undefined }, body);
  });

  test("DELETE validates then delegates", async () => {
    mockDelete.mockResolvedValue({ message: "removed" });
    const res = await DELETE(request("https://x/api/private/cart", { productId: "p1" }, "DELETE") as any);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("ZILEDIGITAL", { userId: "u1", guestId: undefined }, "p1");
  });


  test("POST maps a stale authenticated user to 401 instead of leaking a Prisma FK error", async () => {
    const body = {
      productId: "p1",
      digitalType: "PNG",
      format: "png",
      license: "personal",
      quantity: 1,
    };
    const stale = new Error("stale user");
    mockAdd.mockRejectedValue(stale);
    mockIsOwnerMissing.mockImplementation((error: unknown) => error === stale);

    const res = await POST(request("https://x/api/private/cart", body) as any);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(expect.objectContaining({ error: "session_user_missing" }));
  });

  test("mutations reject when neither user nor guest exists", async () => {
    mockIdentity.mockResolvedValue({});
    const body = { productId: "p1", digitalType: "PNG", format: "png", license: "personal" };
    const res = await POST(request("https://x/api/private/cart", body) as any);
    expect(res.status).toBe(401);
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
