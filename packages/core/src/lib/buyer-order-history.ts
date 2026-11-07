/** Presentation-only helpers for authenticated, store-scoped buyer orders. */
export type OrderTone = "success" | "progress" | "warning" | "neutral";

export function buyerOrderStatus(status: string): { label: string; tone: OrderTone } {
  switch (status.trim().toUpperCase()) {
    case "PAID": return { label: "Paid", tone: "success" };
    case "FULFILLING": return { label: "Being fulfilled", tone: "progress" };
    case "FULFILLED": return { label: "Fulfilled", tone: "success" };
    case "REFUNDED": return { label: "Refunded", tone: "neutral" };
    case "CANCELLED": return { label: "Cancelled", tone: "neutral" };
    case "CANCELED": return { label: "Cancelled", tone: "neutral" };
    case "EXPIRED": return { label: "Expired", tone: "neutral" };
    case "FAILED": return { label: "Payment not confirmed", tone: "warning" };
    case "PAYMENT_FAILED": return { label: "Payment not confirmed", tone: "warning" };
    case "PENDING":
    case "CREATED":
    case "PROCESSING":
    case "AWAITING_PAYMENT": return { label: "Awaiting confirmation", tone: "warning" };
    default: return { label: "Status unavailable", tone: "neutral" };
  }
}

/** Only render server-provided prices; never infer a refund amount from original total. */
export function buyerOrderMoney(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor) || minor < 0 || !/^[A-Z]{3}$/.test(currency)) return "Amount unavailable";
  try {
    const digits = new Intl.NumberFormat("en-US", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat("en-US", { style: "currency", currency })
      .format(minor / (10 ** digits));
  } catch {
    return "Amount unavailable";
  }
}

export function buyerOrderDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}
