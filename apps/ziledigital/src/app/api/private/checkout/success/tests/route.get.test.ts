import { makeNextRequest } from "@acme/core/test/helpers/next";
import { GET } from "../route";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { prisma } from "@acme/core/lib/prisma";

jest.mock("@acme/core/utils/guest", () => ({ getCustomerIdFromRequest: jest.fn() }));
jest.mock("@acme/core/lib/prisma", () => ({ prisma: { order: { findFirst: jest.fn() } } }));

const mockIdentity = getCustomerIdFromRequest as jest.Mock;
const mockFind = (prisma as any).order.findFirst as jest.Mock;

describe("ZileDigital checkout success", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test("401 when not authenticated", async () => {
    mockIdentity.mockResolvedValue({});
    const res = await GET(makeNextRequest("https://x/api/success?session_id=cs1") as any);
    expect(res.status).toBe(401);
  });

  test("returns empty state without session_id", async () => {
    mockIdentity.mockResolvedValue({ userId: "u1" });
    const res = await GET(makeNextRequest("https://x/api/success") as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ order: null, digitalDownloads: [] }));
  });

  test("returns empty state when order is not found", async () => {
    mockIdentity.mockResolvedValue({ userId: "u1" });
    mockFind.mockResolvedValue(null);
    const res = await GET(makeNextRequest("https://x/api/success?session_id=cs1") as any);
    expect(res.status).toBe(200);
    expect((await res.json()).order).toBeNull();
  });

  test("maps token-backed digital downloads", async () => {
    mockIdentity.mockResolvedValue({ guestId: "g1" });

  const order = {
    id: "ord1",
    placedAt: new Date("2026-01-02T03:04:05Z"),
    total: 12,
    items: [{
      id: "oi1",
      type: "DIGITAL",
      price: 12,
      quantity: 1,
      productId: "p1",
      product: { id: "p1", title: "Sky", thumbnails: ["https://cdn.test/p1.jpg"], kind: "DIGITAL" },
      digitalVariant: { id: "dv1", license: "Personal", format: "png" },
      printVariant: null,
    }],
    downloadTokens: [{
      licenseSnapshot: "Personal",
      signedUrl: "https://download.test/token",
      expiresAt: new Date("2026-01-03T03:04:05Z"),
      remainingUses: 2,
      asset: {
        id: "a1", productId: "p1", ext: "png", previewUrl: "https://cdn.test/preview.jpg",
        width: 100, height: 100, dpi: 300, colorProfile: "sRGB", sizeBytes: 123,
        isVector: false, checksum: "abc",
      },
    }],
  };

    mockFind.mockResolvedValue(order);
    const res = await GET(makeNextRequest("https://x/api/success?session_id=cs1") as any);
    const body = await res.json();
    expect(body.hasDigital).toBe(true);
    expect(body.hasPrint).toBe(false);
    expect(body.digitalDownloads).toEqual([
      expect.objectContaining({
        id: "a1", title: "Sky", format: "png", downloadUrl: "https://download.test/token",
        license: "Personal", remainingUses: 2,
      }),
    ]);
  });
});
