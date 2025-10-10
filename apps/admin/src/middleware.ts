// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { MFA_COOKIE, checkMfaCookie } from "@/lib/mfa-edge";


const BLOCKED_WELL_KNOWN = "/.well-known/appspecific/com.chrome.devtools.json";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // ── block Chrome DevTools probe: return Forbidden (no redirect)
  if (path === BLOCKED_WELL_KNOWN) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Allow static & NextAuth
  if (
    path.startsWith("/_next") ||
    path.startsWith("/assets") ||
    path === "/favicon.ico" ||
    path === "/robots.txt") return NextResponse.next();
  if (path.startsWith("/api/auth")) return NextResponse.next();

  // Allow MFA page & MFA APIs (no MFA cookie needed)
  const isVerify = path === "/verify-2fa" || path.startsWith("/verify-2fa/");
  const isMfaApi = path.startsWith("/api/admin/2fa/");
  if (isVerify || isMfaApi) {
    if (isMfaApi) {
      const t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (!t) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (t.isAdmin !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Gate EVERYTHING in this app
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signInUrl = new URL("/api/auth/signin", url.origin);
    signInUrl.searchParams.set("callbackUrl", url.href);
    return NextResponse.redirect(signInUrl);
  }

  // ❗️DON'T redirect to "/" (protected) if not admin — that causes a loop
  if (token.isAdmin !== true) {
    return new NextResponse("Forbidden", { status: 403 }); // or redirect to a public site outside this app
  }

  // Enforce MFA
  const mfa = req.cookies.get(MFA_COOKIE)?.value;
  if (!mfa) {
    const dest = new URL("/verify-2fa", url.origin);
    dest.searchParams.set("next", path + url.search);
    return NextResponse.redirect(dest);
  }

  try {
    const { userId,  } = await checkMfaCookie(mfa);
    if (userId !== token.sub) throw new Error("uid");
    // const sessionIat = typeof token.iat === "number" ? token.iat : 0;
    // if (mfaIat < sessionIat) throw new Error("stale");
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
