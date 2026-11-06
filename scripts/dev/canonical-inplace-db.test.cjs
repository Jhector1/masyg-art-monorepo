"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getUrl, sha, CONFIRM, DISCARD_CONFIRM, approvedLocalDevDiscard, resolveDatabaseUrl, DATABASE_ENV_DIRS, migrationInventory, archiveInertMigrations, MIGRATION_ARCHIVE_CONFIRM, PRISMA_DIFF_ARGS, TARGET_SEARCH_PATH, sealCanonicalSql } = require("./canonical-inplace-db.cjs");
function address(db="haitian_art_store", query="schema=ziledigital", host="localhost") {
  return `postgresql://dev-user:fake-secret@${host}:5432/${db}?${query}`;
}
test("requires the exact existing development database and ziledigital schema", () => {
  assert.equal(getUrl(address()).searchParams.get("schema"), "ziledigital");
  assert.throws(() => getUrl(address("production")), /Expected development database/);
  assert.throws(() => getUrl(address("haitian_art_store","schema=ziledigital_next")), /schema=ziledigital/);
  assert.throws(() => getUrl(address("haitian_art_store","")), /schema=ziledigital/);
});
test("refuses other protocols and transaction poolers", () => {
  assert.throws(() => getUrl("mysql://u:p@localhost:3306/haitian_art_store?schema=ziledigital"), /PostgreSQL/);
  assert.throws(() => getUrl(address("haitian_art_store","schema=ziledigital&pgbouncer=true")), /direct PostgreSQL/);
});
test("remote connections require a distinct acknowledgment", () => {
  const old = process.env.ZILEDIGITAL_REMOTE_DEV_DB_ACK;
  try {
    delete process.env.ZILEDIGITAL_REMOTE_DEV_DB_ACK;
    assert.throws(() => getUrl(address("haitian_art_store","schema=ziledigital","example.net")), /Non-local PostgreSQL/);
    process.env.ZILEDIGITAL_REMOTE_DEV_DB_ACK = "REMOTE_DEV_ONLY";
    assert.equal(getUrl(address("haitian_art_store","schema=ziledigital","example.net")).hostname,"example.net");
  } finally {
    if (old === undefined) delete process.env.ZILEDIGITAL_REMOTE_DEV_DB_ACK;
    else process.env.ZILEDIGITAL_REMOTE_DEV_DB_ACK = old;
  }
});
test("helper has explicit confirmation and stable hashing", () => {
  assert.equal(CONFIRM, "RESET haitian_art_store.ziledigital");
  assert.equal(sha("test"), "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
});

test("uses an existing shell URL without loading an env file", () => {
  const env = { DATABASE_URL: address() };
  const resolved = resolveDatabaseUrl(env, () => { throw new Error("Unexpected env loader invocation"); });
  assert.equal(resolved.value, env.DATABASE_URL);
  assert.equal(resolved.source, "inherited environment");
});
test("loads commerce-api, then Prisma workspace, then root, without exposing the secret", () => {
  const env = {};
  const called = [];
  const expected = DATABASE_ENV_DIRS;
  assert.equal(expected[0].endsWith("/apps/commerce-api"), true);
  assert.equal(expected[1].endsWith("/packages/db"), true);
  const source = resolveDatabaseUrl(env, (dir, dev, log, force) => {
    called.push({dir,dev,force});
    if (dir === expected[1]) env.DATABASE_URL = address();
  }, expected, () => true);
  assert.equal(source.value, address());
  assert.equal(source.source, "packages/db");
  assert.deepEqual(called.map(x => x.dir), expected.slice(0,2));
  assert.equal(called.every(x => x.dev === true && x.force === true), true);
  assert.equal(source.source.includes("fake-secret"), false);
});
test("refuses when no development env file provides DATABASE_URL", () => {
  const env = {};
  assert.throws(() => resolveDatabaseUrl(env, () => {}, DATABASE_ENV_DIRS, () => true), /DATABASE_URL not found/);
});

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
function tempDirs(fn) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ziledigital-migrations-test-"));
  try { fn(base); } finally { fs.rmSync(base, { recursive: true, force: true }); }
}
test("inspects legacy placeholder directories without modifying them", () => tempDirs(base => {
  const root = path.join(base, "migrations");
  fs.mkdirSync(path.join(root, "old_baseline"), {recursive:true});
  fs.writeFileSync(path.join(root, "old_baseline", ".gitkeep"), "keep");
  const inv = migrationInventory(root);
  assert.deepEqual(inv.legacyDirs, ["old_baseline"]);
  assert.equal(inv.sqlFiles.length, 0);
  assert.equal(fs.existsSync(path.join(root, "old_baseline", ".gitkeep")), true);
}));
test("archives inert legacy directories byte-for-byte only on explicit authorization", () => tempDirs(base => {
  const root = path.join(base, "migrations");
  const backup = path.join(base, "backups");
  fs.mkdirSync(path.join(root, "old_baseline"), {recursive:true});
  fs.writeFileSync(path.join(root, "old_baseline", "README"), "Legacy notes\n");
  fs.writeFileSync(path.join(root, "migration_lock.toml"), 'provider = "postgresql"\n');
  assert.throws(() => archiveInertMigrations(root, backup, "WRONG"), /Explicit archive/);
  assert.equal(fs.existsSync(root), true);
  const archived = archiveInertMigrations(root, backup, MIGRATION_ARCHIVE_CONFIRM);
  assert.equal(fs.existsSync(root), false);
  assert.equal(fs.readFileSync(path.join(archived, "old_baseline", "README"), "utf8"), "Legacy notes\n");
  assert.equal(fs.readFileSync(path.join(archived, "migration_lock.toml"), "utf8"), 'provider = "postgresql"\n');
  assert.equal(fs.existsSync(path.join(path.dirname(archived), "archive-manifest.json")), true);
}));
test("refuses to archive any directory with SQL migration files", () => tempDirs(base => {
  const root = path.join(base, "migrations");
  fs.mkdirSync(path.join(root, "old_baseline"), {recursive:true});
  fs.writeFileSync(path.join(root, "old_baseline", "migration.sql"), "CREATE TABLE x (id int);");
  assert.throws(() => archiveInertMigrations(root, path.join(base,"backups")), /Existing SQL migration files/);
  assert.equal(fs.existsSync(path.join(root, "old_baseline", "migration.sql")), true);
}));
test("refuses symlinks and existing canonical migration content", () => tempDirs(base => {
  const root = path.join(base, "migrations");
  fs.mkdirSync(path.join(root, "old_baseline"), {recursive:true});
  fs.symlinkSync(path.join(base,"elsewhere"),path.join(root,"old_baseline","linked"));
  assert.throws(() => archiveInertMigrations(root, path.join(base,"backups")), /Unexpected symlink/);
  fs.unlinkSync(path.join(root,"old_baseline","linked"));
  fs.mkdirSync(path.join(root,"0001_initial"));
  fs.writeFileSync(path.join(root,"0001_initial","README.md"),"canonical");
  assert.throws(() => archiveInertMigrations(root, path.join(base,"backups")), /Canonical initial migration/);
}));

test("Prisma 6.19 initial migration generation uses --to-schema-datamodel", () => {
  assert.deepEqual([...PRISMA_DIFF_ARGS], [
    "exec", "--workspace=@acme/db", "--", "prisma", "migrate", "diff",
    "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script",
  ]);
  assert.equal(PRISMA_DIFF_ARGS.includes("--to-schema"), false);
  assert.equal(Object.isFrozen(PRISMA_DIFF_ARGS), true);
});


test("seals generated canonical SQL to ziledigital before the first unqualified DDL", () => {
  const types = Array.from({length: 13}, (_,i)=>`CREATE TYPE "E${i}" AS ENUM ('X');`).join("\n");
  const tables = ['CREATE TABLE "Organization" ("id" TEXT);', 'CREATE TABLE "Storefront" ("id" TEXT);', ...Array.from({length:34},(_,i)=>`CREATE TABLE "T${i}" ("id" TEXT);`)].join("\n");
  const checks = Array.from({length:9},(_,i)=>`ALTER TABLE "T0" ADD CONSTRAINT "check${i}" CHECK (1=1);`).join("\n");
  const sql = `-- CANONICAL_SCHEMA_SHA256 schema-sha\n-- CANONICAL_CHECKS_SHA256 checks-sha\n-- CreateSchema\nCREATE SCHEMA IF NOT EXISTS "ziledigital";\n\n${types}\n${tables}\n${checks}\n`;
  const sealed = sealCanonicalSql(sql,'schema-sha','checks-sha');
  assert.match(sealed, /CREATE SCHEMA IF NOT EXISTS "ziledigital";\n\nSET search_path TO "ziledigital", pg_catalog;\n/);
  assert.equal(sealed.split(TARGET_SEARCH_PATH).length-1,1);
  assert.equal(sealCanonicalSql(sealed, 'schema-sha','checks-sha'), sealed);
  assert.throws(()=>sealCanonicalSql(sql,'wrong','checks-sha'), /fingerprints/);
  assert.throws(()=>sealCanonicalSql(sql.replace('CREATE TABLE "Storefront"', 'DROP TABLE "Storefront"'),'schema-sha','checks-sha'), /canonical schema boundary/);
  assert.throws(()=>sealCanonicalSql(sql.replace('CREATE SCHEMA IF NOT EXISTS "ziledigital";', 'CREATE SCHEMA IF NOT EXISTS "public";'),'schema-sha','checks-sha'), /canonical schema boundary/);
  assert.throws(()=>sealCanonicalSql(sql.replace('CREATE TYPE "E12" AS ENUM (\'X\');',''),'schema-sha','checks-sha'), /shape differs/);
  assert.throws(()=>sealCanonicalSql(sql.replace('CHECK (1=1)','CHECK (1=1) -- ok'),'schema-sha','wrong-checks-sha'), /fingerprints/);
  assert.throws(()=>sealCanonicalSql(sql.replace('CREATE TABLE "T0"','DROP TABLE "T0"'),'schema-sha','checks-sha'), /Unsafe SQL/);
  assert.throws(()=>sealCanonicalSql(sql.replace('CREATE SCHEMA IF NOT EXISTS "ziledigital";', 'CREATE SCHEMA IF NOT EXISTS "ziledigital";\nSET search_path TO public;'),'schema-sha','checks-sha'), /Unexpected search_path/);
  const misplaced = sql.replace('CREATE TABLE "Organization"', `${TARGET_SEARCH_PATH}\nCREATE TABLE "Organization"`);
  assert.throws(()=>sealCanonicalSql(misplaced, 'schema-sha','checks-sha'), /Unexpected search_path/);
});


test("explicit local development discard requires two exact acknowledgments", () => {
  const config = {u:getUrl(address())};
  const argv = ["node", "helper", "reset", "--discard-legacy-dev-data"];
  assert.equal(approvedLocalDevDiscard(config, ["node","helper","reset"]), false);
  assert.throws(()=>approvedLocalDevDiscard(config, argv), /Explicit reset confirmation/);
  argv.push(`--confirm=${CONFIRM}`);
  assert.throws(()=>approvedLocalDevDiscard(config, argv), /Permanent data loss acknowledgment/);
  argv.push(`--acknowledge=${DISCARD_CONFIRM}`);
  assert.equal(approvedLocalDevDiscard(config, argv, {NODE_ENV:"development"}), true);
  assert.throws(()=>approvedLocalDevDiscard(config, argv.map(x=>x.startsWith("--acknowledge=")?"--acknowledge=WRONG":x)), /Permanent data loss acknowledgment/);
});

test("refuses unbacked discard on remote and production databases", () => {
  const argv = ["node","helper","reset","--discard-legacy-dev-data", `--confirm=${CONFIRM}`, `--acknowledge=${DISCARD_CONFIRM}`];
  assert.throws(()=>approvedLocalDevDiscard({u:new URL(address('haitian_art_store','schema=ziledigital','db.example.test'))}, argv, {ZILEDIGITAL_REMOTE_DEV_DB_ACK:"REMOTE_DEV_ONLY"}), /remote targets refused/);
  const local = {u:getUrl(address())};
  for (const env of [{NODE_ENV:"production"},{VERCEL_ENV:"production"},{ZILEDIGITAL_ENV:"production"}]) {
    assert.throws(()=>approvedLocalDevDiscard(local, argv, env), /prohibited in production/);
  }
  assert.equal(approvedLocalDevDiscard(local, argv, {}), true);
  assert.throws(()=>approvedLocalDevDiscard({u:new URL(address('production'))},argv,{}), /approved local development schema/);
});
