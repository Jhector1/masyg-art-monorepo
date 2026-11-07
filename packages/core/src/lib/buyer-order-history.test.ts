import { buyerOrderDate, buyerOrderMoney, buyerOrderStatus } from "./buyer-order-history";

test("completed and in-progress orders use distinct statuses", () => {
  expect(buyerOrderStatus("PAID")).toEqual({ label: "Paid", tone: "success" });
  expect(buyerOrderStatus("FULFILLING")).toEqual({ label: "Being fulfilled", tone: "progress" });
  expect(buyerOrderStatus("FULFILLED")).toEqual({ label: "Fulfilled", tone: "success" });
});

test("refunds and failures never look paid", () => {
  expect(buyerOrderStatus("REFUNDED")).toEqual({ label: "Refunded", tone: "neutral" });
  expect(buyerOrderStatus("EXPIRED").label).toBe("Expired");
  expect(buyerOrderStatus("FAILED").tone).toBe("warning");
  expect(buyerOrderStatus("PROCESSING").tone).toBe("warning");
  expect(buyerOrderStatus("unknown").tone).toBe("neutral");
});

test("totals respect currency precision and reject invalid values", () => {
  expect(buyerOrderMoney(1000, "USD")).toBe("$10.00");
  expect(buyerOrderMoney(300, "JPY")).toBe("¥300");
  expect(buyerOrderMoney(-1, "USD")).toBe("Amount unavailable");
  expect(buyerOrderMoney(123, "bad")).toBe("Amount unavailable");
});

test("dates render predictably without browser timezone shifts", () => {
  expect(buyerOrderDate("2026-11-06T23:59:00.000Z")).toBe("Nov 6, 2026");
  expect(buyerOrderDate("not-a-date")).toBe("Date unavailable");
});
