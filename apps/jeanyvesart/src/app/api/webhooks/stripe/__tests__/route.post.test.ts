import { makeNextRequest } from "@acme/core/test/helpers/next";
import { POST } from "../route";
import { stripe } from "@acme/core/lib/stripe";
import { prisma } from "@acme/core/lib/prisma";
import { isQuotaTopup, handleQuotaTopup } from "@acme/core/helpers/stripe/webhook/quota";

jest.mock("@acme/core/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));
jest.mock("@acme/core/helpers/stripe/webhook/quota", () => ({
  isQuotaTopup: jest.fn(),
  handleQuotaTopup: jest.fn(),
}));
jest.mock("@acme/core/lib/prisma", () => ({
  prisma: {
    webhookEvent: { findUnique: jest.fn(), create: jest.fn() },
    order: { findFirst: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const constructEvent = stripe.webhooks.constructEvent as jest.Mock;
const mockPrisma = prisma as any;
const mockQuota = isQuotaTopup as unknown as jest.Mock;
const mockQuotaHandle = handleQuotaTopup as unknown as jest.Mock;
const request = (signature = "sig") => makeNextRequest("https://x/api/webhooks/stripe", {
  method: "POST", body: "raw", headersObj: signature ? { "stripe-signature": signature } : {},
});

describe("JeanYves Stripe webhook boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_STRIPE_WEBHOOK_SECRET = "whsec_test";
    constructEvent.mockReturnValue({ id: "evt1", type: "customer.created", data: { object: {} } });
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: "evt1" });
    mockQuota.mockReturnValue(false);
  });

  test("400 without stripe-signature", async () => {
    const res = await POST(request("") as any);
    expect(res.status).toBe(400);
  });

  test("400 on invalid signature", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
    const res = await POST(request() as any);
    expect(res.status).toBe(400);
  });

  test("acknowledges and records an unrelated event", async () => {
    const res = await POST(request() as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  test("deduplicates a previously recorded target event", async () => {
    constructEvent.mockReturnValue({
      id: "evt1",
      type: "checkout.session.completed",
      data: { object: { id: "cs1", payment_status: "paid", metadata: {} } },
    });
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({ id: "evt1" });
    const res = await POST(request() as any);
    expect(await res.json()).toEqual({ received: true, deduped: true });
    expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  test("completed event with no matching order is acknowledged safely", async () => {
    constructEvent.mockReturnValue({
      id: "evt2", type: "checkout.session.completed", data: { object: { id: "cs1", payment_status: "paid", metadata: {} } },
    });
    mockPrisma.order.findUnique.mockResolvedValue(null);
    const res = await POST(request() as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({ data: { id: "evt2" } });
  });

  test("completed quota top-up is handled by the shared quota path", async () => {
    constructEvent.mockReturnValue({
      id: "evt_quota",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_quota",
          payment_status: "paid",
          metadata: { kind: "quota_topup", quota: "export" },
        },
      },
    });
    mockQuota.mockReturnValue(true);

    const res = await POST(request() as any);
    expect(res.status).toBe(200);
    expect(mockQuotaHandle).toHaveBeenCalledTimes(1);
    expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({ data: { id: "evt_quota" } });
  });

  test("500 when post-verification persistence fails", async () => {
    constructEvent.mockReturnValue({
      id: "evt_fail",
      type: "checkout.session.completed",
      data: { object: { id: "cs_fail", payment_status: "paid", metadata: {} } },
    });
    mockPrisma.order.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.create.mockRejectedValue(new Error("db down"));
    const res = await POST(request() as any);
    expect(res.status).toBe(500);
  });
});
