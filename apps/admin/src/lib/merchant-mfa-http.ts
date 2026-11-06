import { NextResponse } from "next/server";
import { MerchantMfaError } from "@/lib/merchant-mfa-service";
import { ZodError } from "zod";
import { TenantAccessError } from "@acme/core/lib/tenancy";
export function merchantSecurityError(error: unknown) {
  if (error instanceof MerchantMfaError || error instanceof TenantAccessError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  if (error instanceof SyntaxError || error instanceof Error && /Invalid origin|Invalid request|Request too large/.test(error.message))
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  console.error("Merchant security operation failed", error);
  return NextResponse.json({ error: "Unable to complete security operation" }, { status: 500 });
}
