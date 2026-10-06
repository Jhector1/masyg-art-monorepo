import { NextRequest, NextResponse } from "next/server";

import {
  getCustomerAuthCookieNames,
  normalizeCustomerSsoOrigin,
  safeCustomerReturnPath,
} from "@acme/auth";

export const dynamic = "force-dynamic";

function ownOrigin() {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured) throw new Error("Missing NEXTAUTH_URL");
  return normalizeCustomerSsoOrigin(configured);
}

function brokerOrigin() {
  const configured = process.env.CUSTOMER_SSO_BROKER_ORIGIN?.trim();
  if (configured) return normalizeCustomerSsoOrigin(configured);
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  throw new Error("Missing CUSTOMER_SSO_BROKER_ORIGIN");
}

function clearCustomerCookies(response: NextResponse) {
  for (const name of Object.values(getCustomerAuthCookieNames())) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  for (const name of [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
  ]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const returnTo = safeCustomerReturnPath(url.searchParams.get("returnTo"), "/");
    const finalReturn = new URL(returnTo, ownOrigin());

    const brokerLogout = new URL("/api/auth/sso/logout", brokerOrigin());
    brokerLogout.searchParams.set("skipPeer", "1");
    brokerLogout.searchParams.set("returnTo", finalReturn.toString());

    const response = NextResponse.redirect(brokerLogout);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    clearCustomerCookies(response);
    return response;
  } catch (error) {
    console.error("[CUSTOMER_SSO_LOGOUT]", error);
    return NextResponse.json({ error: "sso_logout_not_configured" }, { status: 503 });
  }
}
