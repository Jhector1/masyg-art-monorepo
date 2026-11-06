import { createHash } from "node:crypto";

/**
 * Hash the opaque HTTP-only guest cookie before looking up a cart.
 * The cookie is a bearer secret. Never accept an organization/store id from it.
 * Use the same function when a guest cart is created by the canonical cart service.
 */
export function hashGuestCartToken(rawToken: string): string {
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(rawToken)) {
    throw new Error("Invalid guest cart token");
  }
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
