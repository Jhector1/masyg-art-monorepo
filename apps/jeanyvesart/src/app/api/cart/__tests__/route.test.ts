import { makeNextRequest } from "@acme/core/test/helpers/next";
import { GET, POST, PATCH, DELETE } from "../route";
import { getPrincipalFromRequest, getOrCreateGuestId } from "@acme/auth";
import {
  getCart,
  isInCart,
  addToCart,
  patchCart,
  deleteFromCart,
} from "@acme/server/cart/cart.service";

jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@acme/auth", () => ({
  getPrincipalFromRequest: jest.fn(),
  getOrCreateGuestId: jest.fn(),
}));
jest.mock("@acme/server/cart/cart.service", () => ({
  getCart: jest.fn(),
  isInCart: jest.fn(),
  addToCart: jest.fn(),
  patchCart: jest.fn(),
  deleteFromCart: jest.fn(),
}));
jest.mock("@acme/core/lib/prisma", () => ({
  prisma: { cartItem: { deleteMany: jest.fn() } },
}));

const mockPrincipal = getPrincipalFromRequest as jest.Mock;
const mockGuest = getOrCreateGuestId as jest.Mock;
const mockGetCart = getCart as jest.Mock;
const mockIsInCart = isInCart as jest.Mock;
const mockAdd = addToCart as jest.Mock;
const mockPatch = patchCart as jest.Mock;
const mockDelete = deleteFromCart as jest.Mock;

const request = (url: string, body?: unknown) =>
  makeNextRequest(url, {
    method: body === undefined ? "GET" : "POST",
    body,
    headersObj: body === undefined ? undefined : { "content-type": "application/json" },
  });

const json = async (res: Response) => ({ status: res.status, body: await res.json() });

describe("JeanYves cart route boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrincipal.mockResolvedValue({ userId: "u1" });
    mockGuest.mockReturnValue("guest-created");
  });

  test("GET probe delegates to shared cart service with JEANYVES site", async () => {
    mockIsInCart.mockResolvedValue({ inCart: false });
    const res = await GET(request("https://x/api/cart?productId=p1&digitalVariantId=d1") as any);
    expect(await res.json()).toEqual({ inCart: false });
    expect(mockIsInCart).toHaveBeenCalledWith(
      "JEANYVES",
      { userId: "u1", guestId: undefined },
      { productId: "p1", digitalVariantId: "d1", printVariantId: null, originalVariantId: null }
    );
  });

  test("GET list delegates to shared cart service", async () => {
    mockGetCart.mockResolvedValue([{ cartItemId: "ci1" }]);
    const res = await GET(request("https://x/api/cart") as any);
    expect(await res.json()).toEqual([{ cartItemId: "ci1" }]);
    expect(mockGetCart).toHaveBeenCalledWith(
      "JEANYVES",
      { userId: "u1", guestId: undefined },
      { live: false }
    );
  });

  test("POST delegates body and actor to shared cart service", async () => {
    const body = { productId: "p1", originalType: true };
    mockAdd.mockResolvedValue({ message: "added" });
    const out = await json(await POST(request("https://x/api/cart", body) as any));
    expect(out).toEqual({ status: 200, body: { message: "added" } });
    expect(mockAdd).toHaveBeenCalledWith("JEANYVES", { userId: "u1", guestId: undefined }, body);
  });

  test("PATCH delegates to shared cart service", async () => {
    const body = { productId: "p1", updates: { quantity: 1 } };
    mockPatch.mockResolvedValue({ message: "updated" });
    const out = await json(await PATCH(request("https://x/api/cart", body) as any));
    expect(out.status).toBe(200);
    expect(mockPatch).toHaveBeenCalledWith("JEANYVES", { userId: "u1", guestId: undefined }, body);
  });

  test("DELETE by productId delegates to shared cart service", async () => {
    mockDelete.mockResolvedValue({ message: "removed" });
    const body = { productId: "p1" };
    const out = await json(await DELETE(request("https://x/api/cart", body) as any));
    expect(out.body).toEqual({ message: "removed" });
    expect(mockDelete).toHaveBeenCalledWith("JEANYVES", { userId: "u1", guestId: undefined }, "p1");
  });

  test("missing principal receives a generated guest id", async () => {
    mockPrincipal.mockResolvedValue({});
    mockGuest.mockReturnValue("g99");
    mockAdd.mockResolvedValue({ message: "added" });
    const body = { productId: "p1", originalType: true };
    await POST(request("https://x/api/cart", body) as any);
    expect(mockAdd).toHaveBeenCalledWith("JEANYVES", { userId: undefined, guestId: "g99" }, body);
  });
});
