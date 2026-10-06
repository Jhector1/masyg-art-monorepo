import { NextRequest, NextResponse } from "next/server";

import {
  normalizeCustomerSsoOrigin,
  safeCustomerReturnPath,
} from "@acme/auth";

export const dynamic = "force-dynamic";

function brokerOrigin() {
  const configured = process.env.CUSTOMER_SSO_BROKER_ORIGIN?.trim();
  if (configured) return normalizeCustomerSsoOrigin(configured);
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  throw new Error("Missing CUSTOMER_SSO_BROKER_ORIGIN");
}

function ownOrigin() {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured) throw new Error("Missing NEXTAUTH_URL");
  return normalizeCustomerSsoOrigin(configured);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const returnTo = safeCustomerReturnPath(url.searchParams.get("returnTo"), "/");
    const force = url.searchParams.get("force") === "1";

    const broker = new URL("/api/auth/sso/issue", brokerOrigin());
    broker.searchParams.set("target", ownOrigin());
    broker.searchParams.set("returnTo", returnTo);
    if (force) broker.searchParams.set("force", "1");

    const response = NextResponse.redirect(broker);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("[CUSTOMER_SSO_START]", error);
    return NextResponse.json({ error: "sso_not_configured" }, { status: 503 });
  }
}
