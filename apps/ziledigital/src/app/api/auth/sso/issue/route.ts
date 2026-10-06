import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import {
  authOptions,
  isAllowedCustomerSsoOrigin,
  issueCustomerSsoCode,
  normalizeCustomerSsoOrigin,
  safeCustomerReturnPath,
} from "@acme/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ownOrigin() {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured) throw new Error("Missing NEXTAUTH_URL");
  return normalizeCustomerSsoOrigin(configured);
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetRaw = url.searchParams.get("target") ?? "";
  const returnTo = safeCustomerReturnPath(url.searchParams.get("returnTo"), "/");
  const forceLogin = url.searchParams.get("force") === "1";

  if (!isAllowedCustomerSsoOrigin(targetRaw)) {
    return NextResponse.json({ error: "sso_target_not_allowed" }, { status: 400 });
  }

  const target = normalizeCustomerSsoOrigin(targetRaw);
  const callback = new URL("/api/auth/sso/callback", target);
  callback.searchParams.set("returnTo", returnTo);

  const session = await getServerSession(authOptions);
  const userId = session?.user ? String((session.user as any).id ?? "") : "";

  if (!userId) {
    if (!forceLogin) {
      callback.searchParams.set("status", "anonymous");
      return noStoreRedirect(callback);
    }

    const resume = new URL("/api/auth/sso/issue", ownOrigin());
    resume.searchParams.set("target", target);
    resume.searchParams.set("returnTo", returnTo);

    const login = new URL("/authenticate", ownOrigin());
    login.searchParams.set("callbackUrl", `${resume.pathname}${resume.search}`);
    return noStoreRedirect(login);
  }

  try {
    const code = await issueCustomerSsoCode({ userId, audience: target });
    callback.searchParams.set("code", code);
    return noStoreRedirect(callback);
  } catch (error) {
    console.error("[CUSTOMER_SSO_ISSUE]", error);
    return NextResponse.json({ error: "sso_issue_failed" }, { status: 500 });
  }
}
