import { NextRequest } from "next/server";
import { CartSafetyError } from "@acme/core/lib/cart-contract";

/** Apply to cookie-authenticated public POST/PUT/PATCH/DELETE requests. */
export function requireSameOriginJson(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) {
    throw new CartSafetyError(400, "Cross-origin request refused");
  }
  const mediaType = req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") throw new CartSafetyError(400, "Expected JSON");
}
