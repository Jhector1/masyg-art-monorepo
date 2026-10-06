import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getCustomerSessionCookieName } from "@acme/auth/cookies";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: getCustomerSessionCookieName(),
  });

  if (token) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signIn = new URL("/authenticate", req.url);
  signIn.searchParams.set(
    "callbackUrl",
    req.nextUrl.pathname + req.nextUrl.search,
  );
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/favorites",
    "/profile",
    "/api/user/orders/:path*",
    "/api/favorites",
    "/account/:path*",
    "/orders/:path*",
  ],
};
