// middleware.ts (at app root)
export { default } from "next-auth/middleware";

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
