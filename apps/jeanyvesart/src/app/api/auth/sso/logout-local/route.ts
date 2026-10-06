import { NextRequest, NextResponse } from "next/server";

import {
  getCustomerAuthCookieNames,
  normalizeCustomerSsoOrigin,
} from "@acme/auth";

export const dynamic = "force-dynamic";

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
  const url = new URL(req.url);
  const rawReturn = url.searchParams.get("returnTo") ?? "";

  let destination = new URL("/", brokerOrigin());
  try {
    const parsed = new URL(rawReturn);
    if (parsed.origin === brokerOrigin()) destination = parsed;
  } catch {}

  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  clearCustomerCookies(response);
  return response;
}
