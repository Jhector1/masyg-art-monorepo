// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isPath(req: NextRequest, prefix: string) {
  return req.nextUrl.pathname === prefix || req.nextUrl.pathname.startsWith(prefix + "/");
}

function hasGuest(req: NextRequest) {
  return Boolean(req.cookies.get("guest_id")?.value);
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
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // ---- API: private (some allow guest) ----
  if (isPath(req, "/api/private")) {
    // Guest-allowed endpoints
    const guestAllowed =
      isPath(req, "/api/private/cart") ||
      isPath(req, "/api/private/checkout") ||
      isPath(req, "/api/private/designs") ||
      isPath(req, "/api/private/downloads"); // only if downloads are allowed for guest

    if (guestAllowed) {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token || hasGuest(req)) return NextResponse.next();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Everything else under /api/private requires login
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
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
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
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
