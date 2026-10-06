import { NextRequest, NextResponse } from "next/server";

import {
  getCustomerAuthCookieNames,
  isAllowedCustomerSsoOrigin,
  normalizeCustomerSsoOrigin,
  safeCustomerReturnPath,
} from "@acme/auth";

export const dynamic = "force-dynamic";

function ownOrigin() {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured) throw new Error("Missing NEXTAUTH_URL");
  return normalizeCustomerSsoOrigin(configured);
}

function peerOrigin() {
  const configured = process.env.CUSTOMER_SSO_PEER_ORIGIN?.trim();
  if (configured) return normalizeCustomerSsoOrigin(configured);
  if (process.env.NODE_ENV !== "production") return "http://localhost:3002";
  return null;
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

function resolveReturnTo(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("returnTo");
  if (!raw) return new URL("/", ownOrigin());

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return new URL(safeCustomerReturnPath(raw), ownOrigin());
  }

  try {
    const parsed = new URL(raw);
    if (parsed.origin === ownOrigin() || isAllowedCustomerSsoOrigin(parsed.origin)) {
      return parsed;
    }
  } catch {}

  return new URL("/", ownOrigin());
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const skipPeer = url.searchParams.get("skipPeer") === "1";
  const finalReturn = resolveReturnTo(req);
  const peer = peerOrigin();

  let destination = finalReturn;
  if (!skipPeer && peer && isAllowedCustomerSsoOrigin(peer)) {
    const peerLogout = new URL("/api/auth/sso/logout-local", peer);
    peerLogout.searchParams.set("returnTo", finalReturn.toString());
    destination = peerLogout;
  }

  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  clearCustomerCookies(response);
  return response;
}
