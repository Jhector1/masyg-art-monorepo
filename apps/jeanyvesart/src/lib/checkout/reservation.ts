// src/lib/checkout/reservation.ts
export type InventoryStatus = "ACTIVE" | "RESERVED" | "SOLD";

export type ResumeInfo = {
  url: string;
  orderId: string;
  expiresAt?: string | Date | null;
};

export type ResumeState = "idle" | "loading" | "done";

export type ReservationOwner =
  | "NONE"
  | "SOLD"
  | "CHECKING"
  | "YOU"
  | "OTHER";

export type Reservable = {
  status?: InventoryStatus | null;
  reservedOrderId?: string | null;
  reservedUntil?: string | null;
  reservedAt?: string | null;
};

export function getReservationOwner(args: {
  status?: InventoryStatus | null;
  reservedOrderId?: string | null;
  resume: ResumeInfo | null;
  resumeState: ResumeState;
}): ReservationOwner {
  const { status, reservedOrderId, resume, resumeState } = args;

  if (status === "SOLD") return "SOLD";
  if (status !== "RESERVED") return "NONE";

  // While we don't know the user's pending order id yet
  if (resumeState === "loading") return "CHECKING";
  const reservedByMe =
    !!resume?.orderId && !!reservedOrderId && resume.orderId === reservedOrderId;

  return reservedByMe ? "YOU" : "OTHER";
}

export function formatReservedUntil(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
