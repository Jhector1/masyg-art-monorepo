import { getCustomerAuthCookieNames } from "@acme/auth/cookies";
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const names = getCustomerAuthCookieNames();

  res.cookies.set("guest_id", "", { path: "/", maxAge: 0 });
  for (const name of [
    names.callbackUrl,
    names.pkceCodeVerifier,
    names.state,
    names.nonce,
  ]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return res;
}
