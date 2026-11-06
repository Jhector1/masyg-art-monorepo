#!/usr/bin/env node
"use strict";
/** Explicit LOCAL development-only credentials + organization OWNER bootstrap.
 * Never used by server runtime. No passwords on argv, in source files, or in logs.
 */
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../..");
const { loadEnvConfig } = require("@next/env");
if (process.env.NODE_ENV === "production") throw new Error("Refusing production mode");
if (!process.env.DATABASE_URL) {
  loadEnvConfig(path.join(ROOT, "packages/db"), true);
}
const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("Missing development DATABASE_URL");
const url = new URL(raw);
const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
if (!local || decodeURIComponent(url.pathname.slice(1)) !== "haitian_art_store" ||
    url.searchParams.get("schema") !== "ziledigital" ||
    url.searchParams.has("pgbouncer") || !["postgres:", "postgresql:"].includes(url.protocol)) {
  throw new Error("Refusing non-local / unexpected PostgreSQL development target");
}
const args = process.argv.slice(2);
const emailArg = args.find(a => a.startsWith("--email="));
const email = emailArg?.slice(8).trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    !args.includes("--confirm=BOOTSTRAP LOCAL ZILEDIGITAL MERCHANT")) {
  throw new Error('Provide --email=you@example.com and --confirm="BOOTSTRAP LOCAL ZILEDIGITAL MERCHANT"');
}
const password = process.env.ZILEDIGITAL_DEV_MERCHANT_PASSWORD;
if (!password || password.length < 12 || password.length > 256) {
  throw new Error("Set ZILEDIGITAL_DEV_MERCHANT_PASSWORD to a secret of 12–256 characters; never pass it as an argument");
}
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");
const db = new PrismaClient({ datasources: { db: { url: raw } } });
(async () => {
  // Hashing and connection establishment must not consume the 5-second
  // default Prisma interactive-transaction deadline.
  const passwordHash = await hash(password, 12);
  await db.$connect();
  const assignments = await db.$transaction(async tx => {
    const orgs = await tx.organization.findMany({
      where: { slug: { in: ["ziledigital", "jeanyvesart"] } },
      select: { id: true, slug: true, members: { select: { userId: true } } },
    });
    if (orgs.length !== 2 || orgs.some(org => org.members.length !== 0)) {
      throw new Error("Expected exactly two seeded organizations with no members; refusing ownership reassignment");
    }
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new Error("Email already exists; refusing to overwrite credentials");
    }
    const user = await tx.user.create({ data: { email, passwordHash, name: "Development Merchant" } });
    for (const org of orgs) {
      await tx.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: "OWNER" } });
    }
    return orgs.map(org => org.slug);
  }, { maxWait: 15_000, timeout: 30_000 });
  console.log("DEV_MERCHANT_CREATED", email, "OWNER_OF", assignments.join(","));
  console.log("Sign in at the Admin NextAuth credentials page; no platform admin privileges assigned");
})().catch(e => { console.error("BOOTSTRAP_REFUSED:", e.message); process.exitCode=1; })
  .finally(() => db.$disconnect());
