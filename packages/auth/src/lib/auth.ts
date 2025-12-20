import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
// import { prisma } from "@acme/db";
import { syncUserToDb } from "../user-sync";

// Extract a boolean admin signal from Keycloak token (optional).
// Keycloak often puts roles in realm_access.roles or resource_access.
function hasAdminRoleFromToken(token: any) {
  const roles: string[] =
    token?.realm_access?.roles ??
    token?.resource_access?.[process.env.KEYCLOAK_CLIENT_ID!]?.roles ??
    [];
  return roles.includes("admin") || roles.includes("ziledigital_admin");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Real SSO works best with JWT sessions in each app domain.
  session: { strategy: "jwt" },

  providers: [
    Keycloak({
      issuer: process.env.KEYCLOAK_ISSUER, // https://accounts.ziledigital.com/realms/<realm>
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      // Keep IdP tokens if you need them (optional)
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
      }

      const email = profile?.email;
      if (!email) return token;

      // If you want admin driven by Keycloak roles, decode token claims:
      // NOTE: NextAuth does not automatically parse Keycloak role claims into token,
      // but Keycloak often includes them in the id_token/access_token.
      // We'll attempt to use id_token claims if present.
      let isAdminFromIdp = false;
      if (token?.idToken && typeof token.idToken === "string") {
        try {
          const [, payload] = token.idToken.split(".");
          const claims = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
          isAdminFromIdp = hasAdminRoleFromToken(claims);
        } catch {}
      }

      // Sync user into your app DB
      const dbUser = await syncUserToDb({
        email,
        name: profile?.name ?? null,
        image: (profile as any)?.picture ?? null,
        isAdminFromIdp,
      });

      token.userId = dbUser.id;
      token.isAdmin = dbUser.isAdmin;

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error - augmented types below
        session.user.id = token.userId as string;
        // @ts-expect-error - augmented types below
        session.user.isAdmin = token.isAdmin === true;
      }
      return session;
    },
  },
});
