// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";
// import { getToken } from "next-auth/jwt";
export { default } from "next-auth/middleware";


// export async function middleware(req: NextRequest) {
//   const secret = process.env.NEXTAUTH_SECRET;

//   // Try secure cookie (prod default), then fallback to legacy name
//   const token =
//     (await getToken({ req, secret, cookieName: "__Secure-next-auth.session-token" })) ||
//     (await getToken({ req, secret, cookieName: "next-auth.session-token" }));

//   if (!token) {
//     const loginUrl = new URL("/authenticate", req.url);
//     loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
//     return NextResponse.redirect(loginUrl);
//   }

//   return NextResponse.next();
// }

export const config = {
  matcher: ["/profile/:path*", "/store/:path*/studio/:path*", "/favorites/:path*",  "/orders/:path*",
    "/favorites",          // 👈 exact
]   // 👈 children],
};
