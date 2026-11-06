"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const file = path.join(__dirname, "bootstrap-merchant-v26.cjs");
const source = fs.readFileSync(file, "utf8");
const email = "local-merchant@example.test";
const orgs = [
  { id: "org_a", slug: "ziledigital", members: [] },
  { id: "org_b", slug: "jeanyvesart", members: [] },
];

async function simulate({ existingUser = false, owned = false, databaseUrl = "postgresql://local:local@localhost:5432/haitian_art_store?schema=ziledigital" } = {}) {
  const calls = [];
  const user = { id: "u_1" };
  const memberships = [];
  const logs = [];
  let created = 0;
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  const fakeDb = {
    async $connect() { calls.push("connect"); },
    async $disconnect() { calls.push("disconnect"); resolveDone(); },
    async $transaction(callback, config) {
      assert.deepEqual(Object.keys(config).sort(), ["maxWait", "timeout"]);
      assert.ok(config.timeout >= 30000, "transaction timeout must survive cold local dev queries");
      assert.ok(config.maxWait >= 10000);
      assert.equal(calls[0], "hash", "hash password before opening transaction");
      assert.equal(calls[1], "connect", "warm connection before opening transaction");
      calls.push("transaction");
      const tx = {
        organization: {
          async findMany(options) {
            assert.deepEqual(Array.from(options.where.slug.in), ["ziledigital", "jeanyvesart"]);
            return owned ? orgs.map((org, i) => ({ ...org, members: i ? [] : [{ userId: "someone" }] })) : orgs;
          },
        },
        user: {
          async findUnique(options) { assert.equal(options.where.email, email); return existingUser ? user : null; },
          async create(options) {
            assert.equal(options.data.email, email);
            assert.equal(options.data.passwordHash, "secured_hash");
            created++;
            return user;
          },
        },
        organizationMember: {
          async create(options) {
            assert.equal(options.data.userId, user.id);
            assert.equal(options.data.role, "OWNER");
            memberships.push(options.data.organizationId);
          },
        },
      };
      return callback(tx);
    },
  };
  const fakeProcess = {
    env: { NODE_ENV: "development", DATABASE_URL: databaseUrl, ZILEDIGITAL_DEV_MERCHANT_PASSWORD: "a secure test password" },
    argv: ["node", file, `--email=${email}`, "--confirm=BOOTSTRAP LOCAL ZILEDIGITAL MERCHANT"],
    exitCode: 0,
  };
  const stubRequire = (name) => {
    if (name === "@next/env") return { loadEnvConfig() { throw new Error("unexpected env load"); } };
    if (name === "@prisma/client") return { PrismaClient: class { constructor() { return fakeDb; } } };
    if (name === "bcryptjs") return { hash: async (secret, rounds) => {
      assert.equal(secret, fakeProcess.env.ZILEDIGITAL_DEV_MERCHANT_PASSWORD);
      assert.equal(rounds, 12);
      calls.push("hash");
      return "secured_hash";
    } };
    if (name === "node:path") return path;
    throw new Error(`unexpected require ${name}`);
  };
  vm.runInNewContext(source, {
    require: stubRequire, __dirname, process: fakeProcess,
    console: { log(...args) { logs.push(args.join(" ")); }, error(...args) { logs.push(args.join(" ")); } },
    URL,
  }, { filename: file, timeout: 2000 });
  await done;
  return { calls, created, memberships, logs, exitCode: fakeProcess.exitCode };
}

test("bootstrap creates one user and two owner memberships after connection warmup", async () => {
  const outcome = await simulate();
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.created, 1);
  assert.deepEqual(outcome.memberships, ["org_a", "org_b"]);
  assert.match(outcome.logs.join("\n"), /DEV_MERCHANT_CREATED/);
});
test("bootstrap rejects duplicate credentials instead of overwriting", async () => {
  const outcome = await simulate({ existingUser: true });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.created, 0);
  assert.equal(outcome.memberships.length, 0);
  assert.match(outcome.logs.join("\n"), /Email already exists/);
});
test("bootstrap refuses a seeded organization with existing ownership", async () => {
  const outcome = await simulate({ owned: true });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.created, 0);
  assert.equal(outcome.memberships.length, 0);
  assert.match(outcome.logs.join("\n"), /no members/);
});
test("bootstrap rejects non-local database even when credentials are provided", () => {
  assert.throws(() => {
    vm.runInNewContext(source, {
      require(name) {
        if (name === "node:path") return path;
        if (name === "@next/env") return { loadEnvConfig() {} };
        throw new Error(`unexpected dependency ${name}`);
      },
      __dirname,
      process: { env: { DATABASE_URL: "postgresql://x:x@prod.example.com:5432/haitian_art_store?schema=ziledigital" }, argv: ["node", file] },
      URL,
    }, { filename: file, timeout: 1000 });
  }, /Refusing non-local/);
});
