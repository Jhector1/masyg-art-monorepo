import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KeycloakProvider from "next-auth/providers/keycloak";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import { prisma } from "@acme/db"; // ✅ use your singleton
import { syncUserToDb } from "./user-sync";
import { claimGuestData } from "./lib/claimGuestData";
import { getGuestId, clearGuestId } from "./lib/guest";
import { CUSTOMER_SESSION_MAX_AGE_SEC, getCustomerAuthCookies } from "./cookies";
import { consumeCustomerSsoCode, resolveCustomerSsoAudience } from "./sso";

const nonEmpty = (s?: string | null) => (s && s.trim() !== "" ? s : undefined);

function decodeJwtPayload(jwt: string) {
  const [, payload] = jwt.split(".");
  if (!payload) return null;

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), "=");

  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export type AuthFactoryConfig = {
  signInPage?: string; // "/authenticate"
  enableGoogle?: boolean;
  enableKeycloak?: boolean;
  enableCredentials?: boolean;
  enableGuestClaim?: boolean;
  enableSsoHandoff?: boolean;
};

export function createAuthOptions(cfg: AuthFactoryConfig = {}): NextAuthOptions {
  const {
    signInPage = "/authenticate",
    enableGoogle = true,
    enableKeycloak = false,
    enableCredentials = false,
    enableGuestClaim = true,
    enableSsoHandoff = true,
  } = cfg;

  const providers: any[] = [];

  // Internal, one-time cross-domain handoff. This provider is never a public
  // password surface: the opaque code is target-bound, expires after 60s,
  // and is deleted atomically on first successful use.
  if (enableSsoHandoff) {
    providers.push(
      CredentialsProvider({
        id: "customer-sso",
        name: "Customer SSO",
        credentials: {
          code: { label: "Code", type: "text" },
        },
        async authorize(creds) {
          if (!creds?.code) return null;

          const user = await consumeCustomerSsoCode({
            code: creds.code,
            audience: resolveCustomerSsoAudience(),
          });
          if (!user) return null;

          return {
            id: String(user.id),
            email: user.email,
            name: user.name ?? user.email.split("@")[0],
            image: user.avatarUrl ?? user.image ?? null,
            avatarTs: user.updatedAt ? Date.parse(String(user.updatedAt)) : undefined,
          } as any;
        },
      }),
    );
  }

  if (enableCredentials) {
    providers.push(
      CredentialsProvider({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(creds) {
          if (!creds?.email || !creds?.password) return null;

          const user = await prisma.user.findUnique({
            where: { email: creds.email.trim().toLowerCase() },
            select: {
              id: true,
              email: true,
              password: true,
              name: true,
              avatarUrl: true,
              updatedAt: true,
            },
          });

          if (!user) return null;
          const ok = await compare(creds.password, user.password);
          if (!ok) return null;

          return {
            id: String(user.id),
            email: user.email,
            name: user.name ?? user.email.split("@")[0],
            image: user.avatarUrl ?? null,
            avatarTs: user.updatedAt ? Date.parse(String(user.updatedAt)) : undefined,
          } as any;
        },
      })
    );
  }

  if (enableGoogle) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      })
    );
  }

  if (enableKeycloak) {
    providers.push(
      KeycloakProvider({
        clientId: process.env.KEYCLOAK_CLIENT_ID!,
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
        issuer: process.env.KEYCLOAK_ISSUER!,
        authorization: { params: { scope: "openid email profile" } },
      })
    );
  }

  return {
    secret: process.env.NEXTAUTH_SECRET,
    useSecureCookies: process.env.NODE_ENV === "production",
    cookies: getCustomerAuthCookies(),
    session: { strategy: "jwt", maxAge: CUSTOMER_SESSION_MAX_AGE_SEC },
    jwt: { maxAge: CUSTOMER_SESSION_MAX_AGE_SEC },
    providers,

    callbacks: {
      async jwt({ token, user, account, profile }) {
        // ✅ 1) Credentials sign-in (user exists)
        if (user) {
          token.userId = String((user as any).id ?? token.sub ?? "");
          token.email = user.email ?? token.email;
          token.isAdmin = false;
          token.picture = (user as any).image ?? token.picture ?? null;
          (token as any).avatarTs = (user as any).avatarTs ?? (token as any).avatarTs;
        }

        // ✅ 2) OAuth sign-in / refresh
        if (account?.provider === "google" || account?.provider === "keycloak") {
          const claims =
            account.provider === "keycloak" && account.id_token
              ? decodeJwtPayload(account.id_token)
              : null;

          const email =
            (token.email as string | undefined) ||
            (profile as any)?.email ||
            claims?.email ||
            claims?.preferred_username ||
            null;

          if (!email) return token;

          const name =
            (profile as any)?.name ??
            claims?.name ??
            email.split("@")[0];

          const oauthPic = nonEmpty((profile as any)?.picture) ?? nonEmpty(claims?.picture) ?? null;

          // Customer storefront auth never grants administrative privilege.
          // Admin authentication is a separate trust boundary in apps/admin.
          const dbUser = await syncUserToDb({
            email: email.trim().toLowerCase(),
            name,
            image: oauthPic,
            isAdminFromIdp: false,
          });

          token.userId = String(dbUser.id);
          token.isAdmin = false;

          // ✅ avatar precedence: DB avatarUrl > oauthPic > existing token.picture
          const dbAvatar = nonEmpty((dbUser as any).avatarUrl ?? null);
          token.picture = dbAvatar ?? oauthPic ?? (token as any).picture ?? null;

          // ✅ optional: cache bust
          (token as any).avatarTs = (dbUser as any).updatedAt
            ? Date.parse(String((dbUser as any).updatedAt))
            : (token as any).avatarTs;

          // ✅ optional: seed DB avatarUrl once (only if empty and oauthPic exists)
          if (!dbAvatar && oauthPic) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { avatarUrl: oauthPic },
            });
          }

          // ✅ claim guest data once (server-only helper should read cookies())
          if (enableGuestClaim) {
            const guestId = await getGuestId();
            if (guestId && !(token as any).guestClaimed) {
              await claimGuestData({ guestId, userId: String(dbUser.id) });
              await await clearGuestId();
              (token as any).guestClaimed = true;
            }
          }
        }

        return token;
      },

      async session({ session, token }) {
        if (session.user) {
          (session.user as any).id = String((token as any).userId ?? token.sub ?? "");
          (session.user as any).isAdmin = false;
          session.user.image = (token as any).picture ?? null;
          (session.user as any).avatarTs = (token as any).avatarTs ?? null;
        }
        return session;
      },

      async redirect({ url, baseUrl }) {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        try {
          const parsed = new URL(url);
          if (parsed.origin === baseUrl) return url;
        } catch {}
        return baseUrl;
      },
    },

    pages: { signIn: signInPage },
    debug: process.env.NODE_ENV !== "production",
  };
}
