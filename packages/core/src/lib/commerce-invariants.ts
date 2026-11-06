import { createHash } from "node:crypto";

/** Pure domain invariants used by the future transactional checkout coordinator.
 * No public payment/session/order endpoints invoke these functions yet.
 */
export class CommerceInvariantError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CommerceInvariantError";
  }
}

const maxDbInt = 2_147_483_647;
function assertWhole(value: number, name: string, allowZero = true): number {
  if (!Number.isSafeInteger(value) || value > maxDbInt || value < (allowZero ? 0 : 1)) {
    throw new CommerceInvariantError("INVALID_AMOUNT", `${name} must be a nonnegative safe database integer`);
  }
  return value;
}

export type StockLevel = {
  locationId: string;
  onHand: number;
  reserved: number;
};
export type StockAllocation = {locationId: string; quantity: number};

/** Deterministic multi-location allocation; this is a plan, NOT a reservation.
 * The caller must lock/recheck and increment reserved within a SERIALIZABLE
 * PostgreSQL transaction, and persist matching StockHold records atomically.
 */
export function planPhysicalStock(quantity: number, levels: readonly StockLevel[]): StockAllocation[] {
  assertWhole(quantity, "quantity", false);
  if (quantity > 20) throw new CommerceInvariantError("INVALID_QUANTITY", "Maximum 20 per checkout line");
  const locations = new Set<string>();
  const sorted = [...levels].sort((a, b) => a.locationId.localeCompare(b.locationId));
  let remainder = quantity;
  const planned: StockAllocation[] = [];
  for (const level of sorted) {
    if (!/^[a-zA-Z0-9_-]{3,128}$/.test(level.locationId) || locations.has(level.locationId)) {
      throw new CommerceInvariantError("INVALID_STOCK", "Invalid or duplicate stock location");
    }
    locations.add(level.locationId);
    assertWhole(level.onHand, "onHand");
    assertWhole(level.reserved, "reserved");
    if (level.reserved > level.onHand) throw new CommerceInvariantError("INVALID_STOCK", "Reserved exceeds on-hand stock");
    const take = Math.min(remainder, level.onHand - level.reserved);
    if (take > 0) planned.push({locationId: level.locationId, quantity: take});
    remainder -= take;
    if (remainder === 0) break;
  }
  if (remainder !== 0) throw new CommerceInvariantError("OUT_OF_STOCK", "Insufficient unreserved physical stock");
  return planned;
}

export function calculateTrustedOrderTotal(args: {
  currency: string;
  lines: readonly {quantity: number; unitPriceMinor: number; currency: string}[];
  taxMinor: number;
  shippingMinor: number;
  includesPhysical: boolean;
}): {currency: string; subtotalMinor: number; taxMinor: number; shippingMinor: number; totalMinor: number} {
  if (!/^[A-Z]{3}$/.test(args.currency) || args.lines.length === 0 || args.lines.length > 100) {
    throw new CommerceInvariantError("INVALID_CART", "Missing or invalid checkout currency/items");
  }
  let subtotal = 0;
  for (const line of args.lines) {
    const q = assertWhole(line.quantity, "quantity", false);
    if (q > 20 || line.currency !== args.currency) throw new CommerceInvariantError("INVALID_CART", "Invalid line quantity or currency");
    subtotal = assertWhole(subtotal + q * assertWhole(line.unitPriceMinor, "unitPriceMinor"), "subtotalMinor");
  }
  const tax = assertWhole(args.taxMinor, "taxMinor");
  const shipping = assertWhole(args.shippingMinor, "shippingMinor");
  if (!args.includesPhysical && shipping !== 0) throw new CommerceInvariantError("INVALID_SHIPPING", "Digital-only checkout cannot include shipping");
  const total = assertWhole(subtotal + tax + shipping, "totalMinor");
  return {currency: args.currency, subtotalMinor: subtotal, taxMinor: tax, shippingMinor: shipping, totalMinor: total};
}

export type VerifiedPaymentConnection = {
  id: string;
  organizationId: string;
  status: "PENDING" | "VERIFIED" | "DISABLED";
  verifiedAt: Date | null;
  provider: string;
  accountRef: string;
  secretRef: string;
  capabilities: readonly string[];
};

/** A merchant connection must be active and authorized for payments.
 * Caller must independently verify the provider account / its live or test mode,
 * never accept a connection from buyer JSON.
 */
export function assertPaymentConnection(organizationId: string, connection: VerifiedPaymentConnection): void {
  if (connection.organizationId !== organizationId || connection.status !== "VERIFIED" ||
      !(connection.verifiedAt instanceof Date) || !Number.isFinite(connection.verifiedAt.getTime()) ||
      !connection.accountRef || !connection.secretRef || !connection.id ||
      !connection.capabilities.includes("payments")) {
    throw new CommerceInvariantError("PAYMENT_CONNECTION_UNAVAILABLE", "Merchant payment connection unavailable");
  }
}

/** Raw idempotency keys are not stored. Scope uniqueness to org AND store.
 * The caller must use a cryptographically random client idempotency key.
 */
export function hashIdempotencyKey(key: string): string {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{24,128}$/.test(key)) {
    throw new CommerceInvariantError("INVALID_IDEMPOTENCY_KEY", "Invalid checkout idempotency key");
  }
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Order-independent field serialization for server-constructed purchase facts.
 * Only primitive JSON-compatible values accepted; caller supplies canonical
 * snapshot of cart lines, buyer, provider connection and trusted tax/shipping.
 */
function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const pairs = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${pairs.map(([key, val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(",")}}`;
  }
  throw new CommerceInvariantError("INVALID_FINGERPRINT", "Only canonical checkout facts may be fingerprinted");
}
export function checkoutFingerprint(facts: Record<string, unknown>): string {
  return createHash("sha256").update(canonical(facts)).digest("hex");
}

export function assertAttemptReplay(existing: {
  requestFingerprint: string;
  organizationId: string;
  storeId: string;
  status: string;
}, args: {requestFingerprint: string; organizationId: string; storeId: string}): void {
  if (existing.organizationId !== args.organizationId || existing.storeId !== args.storeId ||
      existing.requestFingerprint !== args.requestFingerprint) {
    throw new CommerceInvariantError("IDEMPOTENCY_CONFLICT", "Idempotency key reused for a different checkout");
  }
  if (existing.status === "FAILED" || existing.status === "CANCELLED" || existing.status === "EXPIRED") {
    throw new CommerceInvariantError("CHECKOUT_CLOSED", "Checkout attempt is closed");
  }
}
