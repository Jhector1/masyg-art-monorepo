import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import crypto from "crypto";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

const firstNonEmpty = (...vals: Array<string | null | undefined>) => {
  for (const v of vals) if (v != null && String(v).trim() !== "") return String(v);
  return undefined;
};
const nonEmpty = (s?: string | null) => (s && s.trim() !== "" ? s : undefined);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  // Optional, prevents duplicate accounts when the same verified email uses Google + Credentials
  // allowDangerousEmailAccountLinking: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: creds.email },
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

        const fallbackName = firstNonEmpty(user.name, user.email?.split("@")[0], "User")!;

        // Pass avatar into `user` -> becomes available in jwt({ user })
        return {
          id: String(user.id),
          email: user.email,
          name: fallbackName,
          image: user.avatarUrl ?? null,                 // ← use DB avatar
          avatarUpdatedAt: user.updatedAt?.toISOString() // optional: for cache-busting
        } as any;
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
callbacks: {
  async jwt({ token, user, account, profile }) {
    // carry over from Credentials authorize()
    if (user) {
      token.id = String((user as any).id ?? token.sub ?? "");
      token.email = user.email ?? token.email;
      if ((user as any).image) token.picture = (user as any).image; // avatarUrl from DB
    }

    if (account?.provider === "google") {
      const email = (token.email as string | undefined) || (profile as any)?.email;
      const googlePic = nonEmpty((profile as any)?.picture as string | undefined);

      if (email) {
        // read current DB user (need avatarUrl to decide precedence)
        let dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, avatarUrl: true, updatedAt: true },
        });

        if (!dbUser) {
          // first time: seed avatarUrl with Google picture (ok as default)
          dbUser = await prisma.user.create({
            data: {
              email,
              name: (profile as any)?.name ?? email.split("@")[0],
              password: await hash(`oauth:${crypto.randomUUID()}`, 10),
              avatarUrl: googlePic ?? null,
            },
            select: { id: true, name: true, avatarUrl: true, updatedAt: true },
          });
        } else {
          // existing user: never overwrite a non-null avatarUrl with Google
          // (but if avatarUrl is null and we have a Google pic, set it once)
          if (!nonEmpty(dbUser.avatarUrl) && googlePic) {
            dbUser = await prisma.user.update({
              where: { email },
              data: { avatarUrl: googlePic },
              select: { id: true, name: true, avatarUrl: true, updatedAt: true },
            });
          }
        }

        token.id = dbUser.id;
        // PRECEDENCE: DB avatarUrl > Google picture > existing token.picture
        token.picture = nonEmpty(dbUser.avatarUrl) ?? googlePic ?? (token as any).picture ?? null;
        (token as any).avatarTs = dbUser.updatedAt ? Date.parse(String(dbUser.updatedAt)) : undefined;
      }
    }

    return token;
  },

  async session({ session, token }) {
    if (session.user) {
      (session.user as any).id = String(token.id ?? token.sub ?? "");
      session.user.email = (token.email as string) ?? session.user.email ?? "";

      // expose the **single source** to the client:
      // DB avatarUrl if present, else Google picture stored in token.picture
      session.user.image = (token as any).picture ?? null;

      // optional: timestamp for cache-busting
      (session.user as any).avatarTs = (token as any).avatarTs ?? null;
    }
    return session;
  },
},
  pages: { signIn: "/authenticate" },
  secret: process.env.NEXTAUTH_SECRET,
};




export async function requireAdmin(_req: NextRequest) {
  // TODO: integrate with your NextAuth / RBAC. Throw if not allowed.
  const isAdmin = true;
  if (!isAdmin) {
    const err = new Error("Unauthorized");
    (err as any).status = 401;
    throw err;
  }
}


export function parseList(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof input !== "string") return [];
  // Accept CSV or newline; trim empties
  return input
    .split(/\r?\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listToTextarea(items?: string[]) {
  return (items ?? []).join("\n");
}

/** Convert Date to value for <input type="datetime-local"> (local, no 'Z') */
export function toDatetimeLocalValue(d?: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hh}:${mm}`;
}
