// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getCustomerSessionCookieName } from "@acme/auth/cookies";

async function getCustomerToken(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: getCustomerSessionCookieName(),
  });
}

function isPath(req: NextRequest, prefix: string) {
  return req.nextUrl.pathname === prefix || req.nextUrl.pathname.startsWith(prefix + "/");
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ---- Always allow ----
  if (
    isPath(req, "/api/auth") ||      // NextAuth + your auth routes
    isPath(req, "/api/public") ||    // contact, products, etc.
    isPath(req, "/api/webhooks") ||  // Stripe webhooks (signature protected)
    path.startsWith("/_next") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ---- API: user-only ----
  if (isPath(req, "/api/user")) {
    const token = await getCustomerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // Reserved private routes must always require a signed-in buyer.
  // Guest cookies never authorize checkout settlement or digital downloads.
  if (isPath(req, "/api/private")) {
    const token = await getCustomerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // ---- Pages: protect your private pages here if you want ----
  // Example: /orders, /profile, /favorites should require login
  if (
    isPath(req, "/orders") ||
    isPath(req, "/profile") ||
    isPath(req, "/favorites") ||
    path.includes("/studio")
  ) {
    const token = await getCustomerToken(req);
    if (!token) {
      const loginUrl = new URL("/authenticate", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on API + the few page routes you want protected.
  matcher: [
    "/api/:path*",
    "/orders/:path*",
    "/profile/:path*",
    "/favorites/:path*",
    "/store/:path*/studio/:path*",
  ],
};
