// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { MFA_COOKIE, checkMfaCookie } from "@/lib/mfa-edge";
import { getAdminSessionCookieName } from "@/lib/auth-cookies";

const BLOCKED_WELL_KNOWN = "/.well-known/appspecific/com.chrome.devtools.json";

function emergencyAdminEnabled() {
  return process.env.EMERGENCY_ADMIN_ENABLED?.trim().toLowerCase() === "true";
}

function safeInternalNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/admin";
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // Block Chrome DevTools probe: return Forbidden (no redirect).
  if (path === BLOCKED_WELL_KNOWN) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Allow static assets and NextAuth.
  if (
    path.startsWith("/_next") ||
    path.startsWith("/assets") ||
    path === "/favicon.ico" ||
    path === "/robots.txt"
  ) {
    return NextResponse.next();
  }
  if (path.startsWith("/api/auth")) return NextResponse.next();

  // MFA routes do not require an MFA cookie. A live emergency session does
  // not use the database-backed MFA path at all, so redirect it out of the
  // verification page and reject it immediately when emergency mode is off.
  const isVerify = path === "/verify-2fa" || path.startsWith("/verify-2fa/");
  const isMfaApi = path.startsWith("/api/admin/2fa/");
  if (isVerify || isMfaApi) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: getAdminSessionCookieName() });

    if (token?.isEmergencyAdmin === true) {
      if (!emergencyAdminEnabled()) {
        return new NextResponse("Emergency admin disabled", { status: 403 });
      }

      if (isVerify) {
        return NextResponse.redirect(
          new URL(safeInternalNext(url.searchParams.get("next")), url.origin),
        );
      }

      // The break-glass account intentionally bypasses the normal
      // database/email MFA subsystem. It never needs these APIs.
      return NextResponse.json({ ok: true, bypassed: true });
    }

    if (isMfaApi) {
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (token.isAdmin !== true) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  // Gate EVERYTHING else in this app.
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: getAdminSessionCookieName() });
  if (!token) {
    const signInUrl = new URL("/api/auth/signin", url.origin);
    signInUrl.searchParams.set("callbackUrl", url.href);
    return NextResponse.redirect(signInUrl);
  }

  if (token.isAdmin !== true) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Break-glass means no dependency on Google, Prisma-backed MFA tokens, or
  // email delivery. The environment password is the emergency credential.
  // Disabling EMERGENCY_ADMIN_ENABLED immediately blocks existing emergency
  // JWTs at the edge, even though the JWT itself may not have expired yet.
  if (token.isEmergencyAdmin === true) {
    if (!emergencyAdminEnabled()) {
      return new NextResponse("Emergency admin disabled", { status: 403 });
    }
    return NextResponse.next();
  }

  // Normal admins still require MFA.
  const mfa = req.cookies.get(MFA_COOKIE)?.value;
  if (!mfa) {
    const dest = new URL("/verify-2fa", url.origin);
    dest.searchParams.set("next", path + url.search);
    return NextResponse.redirect(dest);
  }

  try {
    const { userId } = await checkMfaCookie(mfa);
    if (userId !== token.sub) throw new Error("uid");
  } catch {
    const dest = new URL("/verify-2fa", url.origin);
    dest.searchParams.set("next", path + url.search);
    const res = NextResponse.redirect(dest);
    res.cookies.set({ name: MFA_COOKIE, value: "", maxAge: 0, path: "/" });
    return res;
  }

  return NextResponse.next();
}

export const config = { matcher: ["/:path*"] };
