#!/usr/bin/env node
"use strict";

/**
 * Local-only test buyer bootstrap. Intentionally NOT an API route.
 * Creates a GLOBAL User with a bcrypt password hash; no merchant membership,
 * customer organization, order or session is created here.
 */
const path = require("node:path");
const { createRequire } = require("node:module");

const APPROVED_DATABASE = "haitian_art_store";
const APPROVED_SCHEMA = "ziledigital";
const APPROVED_PORT = "5432";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function validateLocalDatabaseUrl(raw) {
  if (typeof raw !== "string" || !raw) throw new Error("DATABASE_URL_REQUIRED");
  let uri;
  try { uri = new URL(raw); } catch { throw new Error("INVALID_DATABASE_URL"); }
  const validProtocol = uri.protocol === "postgresql:" || uri.protocol === "postgres:";
  if (!validProtocol || !LOCAL_HOSTS.has(uri.hostname) ||
      (uri.port || APPROVED_PORT) !== APPROVED_PORT ||
      decodeURIComponent(uri.pathname) !== `/${APPROVED_DATABASE}` ||
      uri.searchParams.get("schema") !== APPROVED_SCHEMA) {
    throw new Error("LOCAL_DATABASE_IDENTITY_MISMATCH");
  }
  return { database: APPROVED_DATABASE, schema: APPROVED_SCHEMA };
}

function validateCustomerInput(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("INVALID_CUSTOMER_INPUT");
  }
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const password = payload.password;
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("INVALID_CUSTOMER_EMAIL");
  }
  if (name.length > 120) throw new Error("INVALID_CUSTOMER_NAME");
  if (typeof password !== "string" || password.length < 12 || password.length > 128 ||
      Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("INVALID_CUSTOMER_PASSWORD_LENGTH");
  }
  return { email, name: name || null, password };
}

async function readPayload() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 4096) throw new Error("CUSTOMER_INPUT_TOO_LARGE");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("INVALID_CUSTOMER_JSON"); }
}

async function createCustomer() {
  if (process.env.NODE_ENV === "production" ||
      process.env.ZILEDIGITAL_CONFIRM_LOCAL_TEST_CUSTOMER !== "true") {
    throw new Error("LOCAL_DEVELOPMENT_CONFIRMATION_REQUIRED");
  }
  validateLocalDatabaseUrl(process.env.DATABASE_URL);
  const { email, name, password } = validateCustomerInput(await readPayload());
  const repo = process.cwd();
  const fromDb = createRequire(path.join(repo, "packages/db/package.json"));
  const fromServer = createRequire(path.join(repo, "packages/server/package.json"));
  const { PrismaClient } = fromDb("@prisma/client");
  const bcrypt = fromServer("bcryptjs");
  const prisma = new PrismaClient();
  try {
    const identity = await prisma.$queryRaw`
      SELECT current_database() AS database_name, current_schema() AS schema_name
    `;
    if (identity.length !== 1 || identity[0].database_name !== APPROVED_DATABASE ||
        identity[0].schema_name !== APPROVED_SCHEMA) {
      throw new Error("CONNECTED_DATABASE_IDENTITY_MISMATCH");
    }
    // Deliberately no upsert, no password reset, and no admin membership.
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new Error("CUSTOMER_EMAIL_ALREADY_EXISTS");
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true },
    });
    // Do not print credentials, password hash, connection URL or session tokens.
    process.stdout.write(`ZILEDIGITAL_LOCAL_TEST_CUSTOMER_CREATED ${user.id} ${user.email}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { validateLocalDatabaseUrl, validateCustomerInput };
if (require.main === module) {
  createCustomer().catch((error) => {
    const known = new Set([
      "DATABASE_URL_REQUIRED", "INVALID_DATABASE_URL", "LOCAL_DATABASE_IDENTITY_MISMATCH",
      "LOCAL_DEVELOPMENT_CONFIRMATION_REQUIRED", "INVALID_CUSTOMER_INPUT",
      "INVALID_CUSTOMER_EMAIL", "INVALID_CUSTOMER_NAME", "INVALID_CUSTOMER_PASSWORD_LENGTH",
      "CUSTOMER_INPUT_TOO_LARGE", "INVALID_CUSTOMER_JSON",
      "CONNECTED_DATABASE_IDENTITY_MISMATCH", "CUSTOMER_EMAIL_ALREADY_EXISTS",
    ]);
    const code = error && error.code === "P2002" ? "CUSTOMER_EMAIL_ALREADY_EXISTS" :
      known.has(error?.message) ? error.message : "CUSTOMER_CREATION_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
