// v4 setup (JWT strategy)
import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@acme/core/lib/prisma";
import { compare } from "bcryptjs";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // ✅ use JWT so middleware getToken() works
  session: { strategy: "jwt" },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: creds.email } });
        if (!user?.password) return null;
        const ok = await compare(creds.password, user.password);
        return ok ? user : null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in we have "user"
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: (user as any).id },
          select: { isAdmin: true, email: true },
        });
        const email = dbUser?.email?.toLowerCase();
        token.isAdmin = dbUser?.isAdmin === true || (email && ADMIN_EMAILS.includes(email));
        token.sub = (user as any).id; // ensure id persists
        return token;
      }

      // Subsequent requests: hydrate if missing
      if (typeof token.isAdmin === "undefined" && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { isAdmin: true, email: true },
        });
        const email = dbUser?.email?.toLowerCase();
        token.isAdmin = dbUser?.isAdmin === true || (email && ADMIN_EMAILS.includes(email));
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub as string;
        (session.user as any).isAdmin = token.isAdmin === true;
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

  trustHost: true,
};
