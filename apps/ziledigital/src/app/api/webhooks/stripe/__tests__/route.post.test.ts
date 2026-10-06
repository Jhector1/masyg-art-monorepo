import { makeNextRequest } from "@acme/core/test/helpers/next";
import { POST } from "../route";
import { stripe } from "@acme/core/lib/stripe";
import { isSessionCompleted, alreadyProcessed, markProcessed } from "@acme/core/helpers/stripe/webhook/utils";
import { isQuotaTopup, handleQuotaTopup } from "@acme/core/helpers/stripe/webhook/quota";
import { handleOrderFulfillment } from "@acme/core/helpers/stripe/webhook/orders";

jest.mock("@acme/core/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));
jest.mock("@acme/core/helpers/stripe/webhook/utils", () => ({
  isSessionCompleted: jest.fn(), alreadyProcessed: jest.fn(), markProcessed: jest.fn(),
}));
jest.mock("@acme/core/helpers/stripe/webhook/quota", () => ({
  isQuotaTopup: jest.fn(), handleQuotaTopup: jest.fn(),
}));
jest.mock("@acme/core/helpers/stripe/webhook/orders", () => ({ handleOrderFulfillment: jest.fn() }));

const constructEvent = stripe.webhooks.constructEvent as jest.Mock;
const mockCompleted = isSessionCompleted as unknown as jest.Mock;
const mockAlready = alreadyProcessed as jest.Mock;
const mockMark = markProcessed as jest.Mock;
const mockQuota = isQuotaTopup as jest.Mock;
const mockQuotaHandle = handleQuotaTopup as jest.Mock;
const mockOrderHandle = handleOrderFulfillment as jest.Mock;

const request = (signature = "sig") => makeNextRequest("https://x/api/webhooks/stripe", {
  method: "POST", body: "raw", headersObj: signature ? { "stripe-signature": signature } : {},
});
const event = { id: "evt1", type: "checkout.session.completed", data: { object: { id: "cs1", payment_status: "paid", metadata: {} } } };

describe("ZileDigital Stripe webhook orchestration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_STRIPE_WEBHOOK_SECRET = "whsec_test";
    constructEvent.mockReturnValue(event);
    mockCompleted.mockReturnValue(true);
    mockAlready.mockResolvedValue(false);
    mockQuota.mockReturnValue(false);
  });

  test("400 without signature", async () => {
    const res = await POST(request("") as any);
    expect(res.status).toBe(400);
  });

  test("500 when webhook secret is missing", async () => {
    delete process.env.NEXT_STRIPE_WEBHOOK_SECRET;
    const res = await POST(request() as any);
    expect(res.status).toBe(500);
  });

  test("400 when Stripe signature verification fails", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    const res = await POST(request() as any);
    expect(res.status).toBe(400);
  });

  test("acknowledges unrelated events without persistence", async () => {
    mockCompleted.mockReturnValue(false);
    const res = await POST(request() as any);
    expect(res.status).toBe(200);
    expect(mockMark).not.toHaveBeenCalled();
  });

  test("deduplicates an already processed event", async () => {
    mockAlready.mockResolvedValue(true);
    const res = await POST(request() as any);
    expect(await res.json()).toEqual({ received: true, deduped: true });
    expect(mockOrderHandle).not.toHaveBeenCalled();
  });


  test("defers fulfillment when Checkout is completed but not paid", async () => {
    constructEvent.mockReturnValue({
      ...event,
      data: { object: { ...event.data.object, payment_status: "unpaid" } },
    });
    const res = await POST(request() as any);
    expect(await res.json()).toEqual({ received: true, deferred: true });
    expect(mockOrderHandle).not.toHaveBeenCalled();
    expect(mockQuotaHandle).not.toHaveBeenCalled();
    expect(mockMark).toHaveBeenCalledWith("evt1");
  });

  test("routes an order session then marks the event processed", async () => {
    const res = await POST(request() as any);
    expect(res.status).toBe(200);
    expect(mockOrderHandle).toHaveBeenCalledWith(event.data.object);
    expect(mockMark).toHaveBeenCalledWith("evt1");
  });

  test("routes quota topups to the quota handler", async () => {
    mockQuota.mockReturnValue(true);
    await POST(request() as any);
    expect(mockQuotaHandle).toHaveBeenCalledWith(event.data.object);
    expect(mockOrderHandle).not.toHaveBeenCalled();
  });

  test("500 on handler failure and does not mark processed", async () => {
    mockOrderHandle.mockRejectedValue(new Error("db down"));
    const res = await POST(request() as any);
    expect(res.status).toBe(500);
    expect(mockMark).not.toHaveBeenCalled();
  });
});
