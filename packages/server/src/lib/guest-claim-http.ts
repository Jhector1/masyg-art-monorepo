import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@acme/core/lib/auth";
import { GuestClaimError } from "@acme/core/lib/guest-purchase-claim";
import { requireSameOriginJson } from "@acme/server/lib/public-request-guard";
import { TenantAccessError, validateTenantId } from "@acme/core/lib/tenancy";
import { z } from "zod";

/** HTTP is OFF by default. Platform operator must first deploy trusted edge
 * IP/device abuse controls and configure SMTP; neither can be inferred here.
 * This is intentionally a staging boundary, not a production activation.
 */
export function guestClaimHttpEnabled(): boolean {
  return process.env.ZILEDIGITAL_GUEST_CLAIM_HTTP_ENABLED === "true" &&
    process.env.ZILEDIGITAL_GUEST_CLAIM_EDGE_PROTECTION_CONFIRMED === "true";
}

export function smtpIsConfigured(): boolean {
  const port = Number(process.env.SMTP_PORT ?? "587");
  const username = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS?.trim();
  const sender = process.env.EMAIL_FROM?.trim();
  const host = process.env.SMTP_HOST?.trim();
  return Boolean(host && sender && username && password &&
    Number.isInteger(port) && port >= 1 && port <= 65535);
}

export const privateClaimHeaders = {
  "Cache-Control": "private, no-store",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
};

export function disabledClaimResponse(): NextResponse {
  return NextResponse.json({ error: "Guest purchase claims are unavailable" },
    { status: 503, headers: privateClaimHeaders });
}

export async function requireClaimUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const id = session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id : null;
  if (!id || !/^[a-zA-Z0-9_-]{3,128}$/.test(id)) {
    throw new GuestClaimError(401, "Authentication required");
  }
  return id;
}

export function claimStoreId(raw: string): string { return validateTenantId(raw); }

const requestInput = z.object({
  orderId: z.string().regex(/^[a-zA-Z0-9_-]{3,128}$/),
}).strict();
const redeemInput = z.object({
  code: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
}).strict();

async function jsonInput(req: NextRequest): Promise<unknown> {
  requireSameOriginJson(req);
  const contentLength = req.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > 1024)) {
    throw new Error("INVALID_GUEST_CLAIM_JSON");
  }
  const raw = await req.text();
  if (raw.length > 1024) throw new Error("INVALID_GUEST_CLAIM_JSON");
  try { return JSON.parse(raw) as unknown; }
  catch { throw new Error("INVALID_GUEST_CLAIM_JSON"); }
}

export async function readClaimRequest(req: NextRequest): Promise<{ orderId: string }> {
  return requestInput.parse(await jsonInput(req));
}
export async function readClaimRedemption(req: NextRequest): Promise<{ code: string }> {
  return redeemInput.parse(await jsonInput(req));
}

export function claimErrorResponse(error: unknown): NextResponse {
  if (error instanceof GuestClaimError || error instanceof TenantAccessError) {
    return NextResponse.json({ error: error.message },
      { status: error.status, headers: privateClaimHeaders });
  }
  if (error instanceof z.ZodError ||
      (error instanceof Error && (error.message === "INVALID_GUEST_CLAIM_JSON" ||
        error.name === "CartSafetyError"))) {
    return NextResponse.json({ error: "Invalid request" },
      { status: 400, headers: privateClaimHeaders });
  }
  // Do not log the full exception: driver errors may contain secret-bearing inputs.
  console.error("Guest purchase claim operation failed");
  return NextResponse.json({ error: "Guest purchase claim unavailable" },
    { status: 500, headers: privateClaimHeaders });
}
