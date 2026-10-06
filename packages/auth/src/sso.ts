import crypto from "crypto";

import { prisma } from "@acme/db";

const SSO_IDENTIFIER_PREFIX = "customer-sso:";
const SSO_CODE_TTL_MS = 60_000;

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function normalizeCustomerSsoOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Unsupported SSO origin protocol");
  }
  if (url.username || url.password) {
    throw new Error("SSO origins must not contain credentials");
  }
  return url.origin;
}

export function resolveCustomerSsoAudience() {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured) throw new Error("Missing NEXTAUTH_URL for customer SSO");
  return normalizeCustomerSsoOrigin(configured);
}

export function getAllowedCustomerSsoOrigins() {
  const configured = process.env.CUSTOMER_SSO_ALLOWED_ORIGINS?.trim();
  if (!configured) {
    if (process.env.NODE_ENV !== "production") {
      return new Set(["http://localhost:3001", "http://localhost:3002"]);
    }
    return new Set<string>();
  }

  const out = new Set<string>();
  for (const raw of configured.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    out.add(normalizeCustomerSsoOrigin(trimmed));
  }
  return out;
}

export function isAllowedCustomerSsoOrigin(value: string) {
  let origin: string;
  try {
    origin = normalizeCustomerSsoOrigin(value);
  } catch {
    return false;
  }
  return getAllowedCustomerSsoOrigins().has(origin);
}

export function safeCustomerReturnPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "http://customer-sso.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function encodeIdentifier(payload: { audience: string; userId: string }) {
  return `${SSO_IDENTIFIER_PREFIX}${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

function decodeIdentifier(identifier: string) {
  if (!identifier.startsWith(SSO_IDENTIFIER_PREFIX)) return null;
  const encoded = identifier.slice(SSO_IDENTIFIER_PREFIX.length);
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || typeof parsed.audience !== "string" || typeof parsed.userId !== "string") {
      return null;
    }
    return {
      audience: normalizeCustomerSsoOrigin(parsed.audience),
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

export async function issueCustomerSsoCode(args: { userId: string; audience: string }) {
  const audience = normalizeCustomerSsoOrigin(args.audience);
  const userId = String(args.userId || "").trim();
  if (!userId) throw new Error("Missing SSO user id");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new Error("SSO user no longer exists");

  const identifier = encodeIdentifier({ audience, userId });
  const rawCode = crypto.randomBytes(32).toString("base64url");
  const token = sha256(rawCode);
  const now = new Date();
  const expires = new Date(now.getTime() + SSO_CODE_TTL_MS);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: {
        OR: [
          { identifier },
          { identifier: { startsWith: SSO_IDENTIFIER_PREFIX }, expires: { lt: now } },
        ],
      },
    }),
    prisma.verificationToken.create({
      data: { identifier, token, expires },
    }),
  ]);

  return rawCode;
}

export async function consumeCustomerSsoCode(args: { code: string; audience: string }) {
  const code = String(args.code || "").trim();
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(code)) return null;

  const audience = normalizeCustomerSsoOrigin(args.audience);
  const token = sha256(code);
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.verificationToken.findUnique({ where: { token } });
      if (!row) return null;

      if (row.expires <= now) {
        await tx.verificationToken.delete({ where: { token } }).catch(() => undefined);
        return null;
      }

      const payload = decodeIdentifier(row.identifier);
      if (!payload || payload.audience !== audience) return null;

      // Delete first inside the transaction: only one consumer can succeed.
      await tx.verificationToken.delete({ where: { token } });

      return tx.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          avatarUrl: true,
          updatedAt: true,
        },
      });
    });
  } catch {
    // A concurrent replay loses the delete race and is treated as invalid.
    return null;
  }
}
