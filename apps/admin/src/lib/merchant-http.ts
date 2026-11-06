import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { TenantAccessError } from "@acme/core/lib/tenancy";
import { CatalogStateError } from "@acme/core/lib/catalog-lifecycle";
import { ZodError } from "zod";

export function merchantHttpError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid input", issues: error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
  }
  if (error instanceof CatalogStateError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof TenantAccessError) {
    return NextResponse.json({ error: error.message,
      ...(error.status === 428 ? { code: "MERCHANT_MFA_REQUIRED" } : {}),
    }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Name or slug already in use" }, { status: 409 });
  }
  return NextResponse.json({ error: "Unable to process request" }, { status: 500 });
}
export function parseMerchantBody(input: unknown): {
  organizationName: string; organizationSlug: string; storeName: string; storeSlug: string;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid JSON body");
  const obj = input as Record<string, unknown>;
  const keys = ["organizationName", "organizationSlug", "storeName", "storeSlug"] as const;
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = obj[key];
    if (typeof value !== "string") throw new Error(`Missing or invalid ${key}`);
    values[key] = value;
  }
  return values as ReturnType<typeof parseMerchantBody>;
}
export function badRequest() {
  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
