import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KeycloakProvider from "next-auth/providers/keycloak";

// import { syncUserToDb } from "/lib/syncUserToDb";
// import { claimGuestData } from "./claimGuestData";
import { getGuestId, clearGuestId } from "./lib/guest";
import { claimGuestData } from "./lib/claimGuestData";
import { syncUserToDb } from "./user-sync";

function hasAdminRoleFromClaims(claims: any) {
  const roles =
    claims?.realm_access?.roles ??
    claims?.resource_access?.[process.env.KEYCLOAK_CLIENT_ID!]?.roles ??
    [];
  return roles.includes("admin") || roles.includes("ziledigital_admin");
}

function decodeJwtPayload(jwt: string) {
  const [, payload] = jwt.split(".");
  if (!payload) return null;

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), "=");

  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      authorization: { params: { scope: "openid email profile" } },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (!account) return token;

      let claims = null;
      if (account.id_token) {
        try {
          claims = decodeJwtPayload(account.id_token);
        } catch {}
      }

      const email =
        (profile as any)?.email ??
        claims?.email ??
        claims?.preferred_username ??
        null;

      if (!email) return token;

      const name =
        (profile as any)?.name ??
        claims?.name ??
        null;

      const image =
        (profile as any)?.picture ??
        claims?.picture ??
        null;

      const isAdminFromIdp =
        account.provider === "keycloak" && claims
          ? hasAdminRoleFromClaims(claims)
          : false;

      const user = await syncUserToDb({
        email,
        name,
        image,
        isAdminFromIdp,
      });

      token.userId = user.id;
      token.isAdmin = user.isAdmin;

      // 🔥 CLAIM GUEST DATA ON FIRST LOGIN
      const guestId = getGuestId();

      if (guestId && !token.guestClaimed) {
        await claimGuestData({
          guestId,
          userId: user.id,
        });

        clearGuestId(); // optional but recommended
        token.guestClaimed = true;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).isAdmin = token.isAdmin === true;
      }
      return session;
    },
  },

  pages: {
    signIn: "/authenticate",
  },

  debug: process.env.NODE_ENV !== "production",
};
