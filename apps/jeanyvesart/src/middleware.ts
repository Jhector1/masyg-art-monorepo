// middleware.ts (at app root)
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/favorites",
    "/profile",
    "/api/orders/:path*",
    "/account/:path*",
    "/orders/:path*",
  ],
};
