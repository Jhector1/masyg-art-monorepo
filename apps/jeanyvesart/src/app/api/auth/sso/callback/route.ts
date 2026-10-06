import { NextRequest, NextResponse } from "next/server";

import { safeCustomerReturnPath } from "@acme/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const returnTo = safeCustomerReturnPath(url.searchParams.get("returnTo"), "/");
  const code = String(url.searchParams.get("code") ?? "").trim();

  if (!code) {
    const response = NextResponse.redirect(new URL(returnTo, url.origin));
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }

  if (!/^[A-Za-z0-9_-]{32,256}$/.test(code)) {
    return NextResponse.json({ error: "invalid_sso_code" }, { status: 400 });
  }

  const complete = new URL("/authenticate/sso", url.origin);
  complete.searchParams.set("code", code);
  complete.searchParams.set("callbackUrl", returnTo);

  const response = NextResponse.redirect(complete);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
