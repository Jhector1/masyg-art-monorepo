// src/lib/auth.ts
import { getServerSession, type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@acme/core/lib/prisma";
import { compare } from "bcryptjs";
import { requiresMerchantEmailVerification } from "@acme/core/lib/merchant-email-policy";
import { randomUUID } from "node:crypto";
import {
  EMERGENCY_ADMIN_USER_ID,
  getEmergencyAdminEmail,
  isEmergencyAdminEnabled,
  isEmergencyAdminUserId,
  validateEmergencyAdminCredentials,
} from "@/lib/emergency-admin";
import { ADMIN_SESSION_MAX_AGE, getAdminAuthCookies } from "@/lib/auth-cookies";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: getAdminAuthCookies(),

  // Admin sessions are intentionally shorter than storefront sessions.
  session: { strategy: "jwt", maxAge: ADMIN_SESSION_MAX_AGE },
  jwt: { maxAge: ADMIN_SESSION_MAX_AGE },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;

        if (validateEmergencyAdminCredentials(creds.email, creds.password)) {
          return {
            id: EMERGENCY_ADMIN_USER_ID,
            email: getEmergencyAdminEmail(),
            name: "Emergency Admin",
          };
        }

        const email = creds.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await compare(creds.password, user.passwordHash);
        // Password identity is not email ownership. Re-enabling verification blocks unverified accounts,
        // including accounts created while SMTP verification was disabled.
        if (ok && requiresMerchantEmailVerification(process.env.MERCHANT_EMAIL_VERIFICATION_REQUIRED) &&
            !user.emailVerified) return null;
        return ok ? { id: user.id, email: user.email, name: user.name, image: user.image } : null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        const userId = user.id;

        if (isEmergencyAdminUserId(userId)) {
          token.sub = EMERGENCY_ADMIN_USER_ID;
          token.email = getEmergencyAdminEmail();
          token.name = "Emergency Admin";
          token.isAdmin = true;
          token.isEmergencyAdmin = true;
          return token;
        }

        // Only Google-backed verified identities may mark the account verified.
        if (account?.provider === "google" &&
            (profile as { email_verified?: unknown } | undefined)?.email_verified === true) {
          await prisma.user.updateMany({ where: { id: userId!, emailVerified: null },
            data: { emailVerified: new Date() } });
        }
        token.merchantSessionId = randomUUID();
        const dbUser = await prisma.user.findUnique({
          where: { id: userId! },
          select: { email: true },
        });
        const email = dbUser?.email?.toLowerCase();
        token.isAdmin =
          !!email && ADMIN_EMAILS.includes(email);
        token.sub = userId;
        token.isEmergencyAdmin = false;
        return token;
      }

      if (token.isEmergencyAdmin === true) {
        // Turning the break-glass account off must also revoke existing
        // emergency JWTs instead of leaving them usable for maxAge.
        token.isAdmin = isEmergencyAdminEnabled();
        return token;
      }

      if (token.sub) {
        if (typeof token.merchantSessionId !== "string") token.merchantSessionId = randomUUID();
        // Re-check normal admin authorization whenever NextAuth refreshes the
        // server session. This prevents a long-lived JWT from preserving an
        // admin grant after the database/admin allowlist has been changed.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { email: true },
        });
        const email = dbUser?.email?.toLowerCase();
        token.isAdmin =
          !!email && ADMIN_EMAILS.includes(email);
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, {
          id: token.sub,
          isAdmin: token.isAdmin === true,
          isEmergencyAdmin: token.isEmergencyAdmin === true,
          merchantSessionId: typeof token.merchantSessionId === "string" ? token.merchantSessionId : undefined,
        });
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const u = new URL(url);
        if (u.origin === baseUrl) return url;
      } catch {}
      return baseUrl;
    },
  },

};

export async function auth() {
  return getServerSession(authOptions);
}
export type Session = Awaited<ReturnType<typeof auth>>;
