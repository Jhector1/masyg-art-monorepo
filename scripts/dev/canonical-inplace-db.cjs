#!/usr/bin/env node
"use strict";
/* Local development only. Never drops a database. The confirmed reset replaces
 * only the ziledigital schema, using either a verified backup or explicit approval
 * to permanently discard disposable legacy local development data.
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
const DB_NAME = "haitian_art_store";
const SCHEMA = "ziledigital";
const CONFIRM = `RESET ${DB_NAME}.${SCHEMA}`;
const MIGRATIONS = path.join(ROOT, "packages/db/prisma/migrations");
const INIT = path.join(MIGRATIONS, "0001_initial/migration.sql");
const LOCK = path.join(MIGRATIONS, "migration_lock.toml");
const PRISMA_SCHEMA = path.join(ROOT, "packages/db/prisma/schema.prisma");
const CHECKS = path.join(ROOT, "docs/db/canonical-initial-checks.sql");
const BACKUP_DIR = path.join(os.homedir(), ".ziledigital-dev-db-backups");
const LATEST = path.join(BACKUP_DIR, "latest.json");
const mode = process.argv[2] || "help";
function fail(s) { throw new Error(s); }
function sha(text) { return crypto.createHash("sha256").update(text).digest("hex"); }
function shaFile(file) { return sha(fs.readFileSync(file)); }
function getUrl(source) {
  const u = new URL(source);
  if (!["postgresql:", "postgres:"].includes(u.protocol)) fail("PostgreSQL URL required");
  if (decodeURIComponent(u.pathname.slice(1)) !== DB_NAME) fail(`Expected development database ${DB_NAME}; refusing`);
  if (u.searchParams.get("schema") !== SCHEMA) fail(`DATABASE_URL must specify schema=${SCHEMA}`);
  const host = u.hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.ZILEDIGITAL_REMOTE_DEV_DB_ACK !== "REMOTE_DEV_ONLY") {
    fail("Non-local PostgreSQL host refused; only for confirmed remote development use ZILEDIGITAL_REMOTE_DEV_DB_ACK=REMOTE_DEV_ONLY");
  }
  if (u.searchParams.has("pgbouncer")) fail("A direct PostgreSQL connection is required, not a pgBouncer transaction pool");
  return u;
}
// The commerce API and Prisma CLI normally load their own workspace .env files.
// Do not require developers to source secrets into their interactive shell.
const DATABASE_ENV_DIRS = Object.freeze([
  path.join(ROOT, "apps/commerce-api"),
  path.join(ROOT, "packages/db"),
  ROOT,
]);
function resolveDatabaseUrl(env, loadEnvConfig, directories = DATABASE_ENV_DIRS, dirExists = fs.existsSync) {
  if (env.DATABASE_URL) return { value: env.DATABASE_URL, source: "inherited environment" };
  for (const dir of directories) {
    if (!dirExists(dir)) continue;
    // forceReload is required when checking more than one Next.js project directory.
    // dev=true ignores production-specific .env files for this destructive dev helper.
    loadEnvConfig(dir, true, undefined, true);
    if (env.DATABASE_URL) return { value: env.DATABASE_URL, source: path.relative(ROOT, dir) || "repository root" };
  }
  fail("DATABASE_URL not found in shell, apps/commerce-api, packages/db, or repository root development .env files");
}
function loadConfig() {
  const { loadEnvConfig } = require("@next/env");
  const resolved = resolveDatabaseUrl(process.env, loadEnvConfig);
  const u = getUrl(resolved.value);
  // Display only the source, not the URL, credentials, or other secrets.
  console.log(`DEV_DATABASE_ENV_SOURCE ${resolved.source}`);
  return { u, url: u.toString(), identity: sha([u.hostname, u.port || "5432", u.username, u.pathname, SCHEMA].join("|")) };
}
function prismaDb(url) {
  const { PrismaClient } = require("@prisma/client");
  return new PrismaClient({ datasources: { db: { url } } });
}
function child(cmd, args, env = {}, capture = false) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.error) fail(`${cmd} failed: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} exited ${r.status}${capture ? ": " + String(r.stderr || "").slice(0, 1200) : ""}`);
  return r.stdout || "";
}
function pgEnv(u) {
  // Never put the database password on the process command line or in a file.
  const env = {
    PGHOST: u.hostname.replace(/^\[(.*)\]$/, "$1"),
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: DB_NAME,
  };
  if (u.searchParams.has("sslmode")) env.PGSSLMODE = u.searchParams.get("sslmode");
  return env;
}
// Inventory and explicitly archive inert legacy migration folders before
// creating the clean development baseline. Existing SQL migrations are NEVER
// moved automatically; those require a deliberate human migration review.
const MIGRATION_ARCHIVE_CONFIRM = "ARCHIVE INERT PRISMA MIGRATIONS";
function migrationInventory(root = MIGRATIONS) {
  if (!fs.existsSync(root)) return { entries: [], legacyDirs: [], sqlFiles: [], symlinks: [] };
  if (!fs.lstatSync(root).isDirectory()) fail("Prisma migrations path is not a directory");
  const entries = [], sqlFiles = [], symlinks = [];
  function walk(dir, prefix = "") {
    for (const d of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${d.name}` : d.name;
      const abs = path.join(dir, d.name);
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) {
        symlinks.push(relative); entries.push({path: relative, type: "symlink"});
      } else if (st.isDirectory()) {
        entries.push({path: relative, type: "directory"});
        walk(abs, relative);
      } else if (st.isFile()) {
        entries.push({path: relative, type: "file", sha256: shaFile(abs)});
        if (/\.sql$/i.test(d.name)) sqlFiles.push(relative);
      } else {
        entries.push({path: relative, type: "unsupported"});
      }
    }
  }
  walk(root);
  return {
    entries,
    legacyDirs: entries.filter(e => e.type === "directory" && !e.path.includes("/") && e.path !== "0001_initial").map(e => e.path),
    sqlFiles, symlinks,
  };
}
function printMigrationInventory(root = MIGRATIONS) {
  const inv = migrationInventory(root);
  console.log(`PRISMA_MIGRATION_INVENTORY entries=${inv.entries.length} legacyDirs=${inv.legacyDirs.length} sqlFiles=${inv.sqlFiles.length} symlinks=${inv.symlinks.length}`);
  for (const item of inv.entries.slice(0, 100)) console.log(`MIGRATION_ENTRY ${item.type} ${item.path}`);
  if (inv.entries.length > 100) console.log(`MIGRATION_ENTRIES_OMITTED ${inv.entries.length - 100}`);
  return inv;
}
function archiveInertMigrations(root = MIGRATIONS, archiveParent = BACKUP_DIR, confirmation = MIGRATION_ARCHIVE_CONFIRM) {
  if (confirmation !== MIGRATION_ARCHIVE_CONFIRM) fail("Explicit archive acknowledgement required");
  const inv = migrationInventory(root);
  if (!inv.legacyDirs.length) fail("No legacy migration directories found; do not archive canonical migrations");
  if (inv.symlinks.length || inv.entries.some(e => e.type === "unsupported")) fail("Unexpected symlink or file type in migration directory; manual review required");
  if (inv.sqlFiles.length) fail(`Existing SQL migration files found (${inv.sqlFiles.slice(0,4).join(", ")}); refusing archival`);
  if (inv.entries.some(e => e.path.startsWith("0001_initial/"))) fail("Canonical initial migration already exists; refusing archival");
  // The entire original tree, including migration_lock.toml and placeholder
  // files, is retained under the home directory for human inspection.
  fs.mkdirSync(archiveParent, { recursive: true, mode: 0o700 });
  const directory = fs.mkdtempSync(path.join(archiveParent, "legacy-prisma-migrations-"));
  const destination = path.join(directory, "migrations");
  const fingerprint = sha(JSON.stringify(inv.entries));
  try {
    fs.renameSync(root, destination);
    const archived = migrationInventory(destination);
    if (sha(JSON.stringify(archived.entries)) !== fingerprint) {
      fs.renameSync(destination, root);
      fail("Archive contents changed unexpectedly; original migration tree restored");
    }
    fs.writeFileSync(path.join(directory, "archive-manifest.json"), JSON.stringify({
      createdAt: new Date().toISOString(),
      originalPath: root,
      fingerprintSha256: fingerprint,
      entries: archived.entries,
    }, null, 2) + "\n", {mode: 0o600, flag: "wx"});
  } catch (error) {
    if (fs.existsSync(destination) && !fs.existsSync(root)) {
      try {fs.renameSync(destination, root);} catch {}
    }
    throw error;
  }
  console.log("ARCHIVED_INERT_LEGACY_MIGRATIONS", destination);
  console.log("ARCHIVE_VERIFIED_SHA256", fingerprint);
  console.log("NO_DATABASE_CHANGES_MADE");
  return destination;
}
// Canonical generated SQL contains unqualified CREATE TYPE / CREATE TABLE statements.
// Make their target namespace explicit rather than depending on connection defaults.
const TARGET_SEARCH_PATH = 'SET search_path TO "ziledigital", pg_catalog;';
const CREATE_SCHEMA_DDL = 'CREATE SCHEMA IF NOT EXISTS "ziledigital";';
function sealCanonicalSql(sql, schemaHash, checksHash) {
  if (!sql.includes(`-- CANONICAL_SCHEMA_SHA256 ${schemaHash}`) || !sql.includes(`-- CANONICAL_CHECKS_SHA256 ${checksHash}`)) {
    fail("Migration fingerprints differ from current canonical schema/checks; refusing to seal");
  }
  const occurrences = sql.split(CREATE_SCHEMA_DDL).length - 1;
  if (occurrences !== 1 || !sql.includes('CREATE TABLE "Storefront"') || !sql.includes('CREATE TABLE "Organization"')) {
    fail("Unexpected generated SQL; cannot establish canonical schema boundary");
  }
  if (/\bDROP\s+(SCHEMA|TABLE|DATABASE)\b|\bTRUNCATE\b/i.test(sql)) fail("Unsafe SQL in baseline; refusing to seal");
  if ((sql.match(/CREATE TABLE "/g) || []).length !== 36 ||
      (sql.match(/CREATE TYPE "/g) || []).length !== 13 ||
      (sql.match(/CHECK \(/g) || []).length !== 9) {
    fail("Canonical baseline shape differs from reviewed 36 tables / 13 enums / 9 CHECKs; manual review required");
  }
  const searchPathDeclarations = sql.match(/\bSET\s+search_path\s+TO\b/gi) || [];
  if (searchPathDeclarations.length > 0) {
    if (searchPathDeclarations.length !== 1 ||
        !sql.includes(`${CREATE_SCHEMA_DDL}\n\n${TARGET_SEARCH_PATH}\n`)) {
      fail("Unexpected search_path statement; manual review required");
    }
    return sql;
  }
  return sql.replace(CREATE_SCHEMA_DDL, `${CREATE_SCHEMA_DDL}\n\n${TARGET_SEARCH_PATH}`);
}
function sealInitialMigration() {
  ensureMigration(true);
  if (!fs.existsSync(INIT) || !fs.existsSync(LOCK)) fail("Run prepare first; baseline migration missing");
  if (fs.lstatSync(INIT).isSymbolicLink()) fail("Migration SQL is symlinked; refusing");
  const original = fs.readFileSync(INIT, "utf8");
  const sealed = sealCanonicalSql(original, shaFile(PRISMA_SCHEMA), shaFile(CHECKS));
  if (sealed !== original) {
    const tmp = `${INIT}.seal-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
    try {
      fs.writeFileSync(tmp, sealed, {flag:"wx", mode:0o600});
      fs.renameSync(tmp, INIT);
    } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  }
  ensureMigration();
  console.log("CANONICAL_SQL_SEALED", INIT, "SCHEMA ziledigital", sealed === original ? "ALREADY_SEALED" : "UPDATED");
  console.log("NO_DATABASE_CHANGES_MADE");
}
function ensureMigration(prereqOnly = false) {
  if (!fs.existsSync(PRISMA_SCHEMA) || !fs.existsSync(CHECKS)) fail("Canonical schema/check constraints missing");
  const inv = migrationInventory();
  if (inv.legacyDirs.length) {
    fail(`Legacy Prisma migrations present (${inv.legacyDirs.slice(0,6).join(", ")}); run inspect-migrations, then explicitly archive inert folders only after review`);
  }
  if (inv.symlinks.length || inv.entries.some(e => e.type === "unsupported")) fail("Unexpected migration path or symlink; review before preparing baseline");
  if (prereqOnly) return;
  if (!fs.existsSync(INIT) || !fs.existsSync(LOCK)) fail("Run prepare first; baseline migration missing");
  if (!/provider\s*=\s*"postgresql"/.test(fs.readFileSync(LOCK, "utf8"))) fail("Unexpected Prisma migration lock");
  const sql = fs.readFileSync(INIT, "utf8");
  if (!sql.includes(`-- CANONICAL_SCHEMA_SHA256 ${shaFile(PRISMA_SCHEMA)}`)) fail("Canonical Prisma schema changed after migration generation");
  if (!sql.includes(`-- CANONICAL_CHECKS_SHA256 ${shaFile(CHECKS)}`)) fail("Canonical SQL constraints changed after migration generation");
  for (const name of ["Storefront", "Organization", "ProductVariant", "Order", "StoreDomain"]) {
    if (!sql.includes(`CREATE TABLE "${name}"`)) fail(`Migration missing ${name}`);
  }
  if (!sql.includes("ProductVariant_priceMinor_nonnegative")) fail("Missing nonnegative money constraints");
  if (!sql.includes(TARGET_SEARCH_PATH)) fail("Canonical initial migration lacks explicit ziledigital search_path; run seal before reset/apply");
  if (/\bDROP\s+(SCHEMA|TABLE|DATABASE)\b|\bTRUNCATE\b/i.test(sql)) fail("Destructive SQL is not allowed in initial migration");
}
// Pin this to the CLI accepted by the repository's Prisma 6.19.x toolchain.
// Keep the invocation inspectable and unit-tested independently of PostgreSQL.
const PRISMA_DIFF_ARGS = Object.freeze([
  "exec", "--workspace=@acme/db", "--", "prisma", "migrate", "diff",
  "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script",
]);
function prepare(url) {
  ensureMigration(true);
  if (fs.existsSync(INIT)) { ensureMigration(); console.log("INITIAL_MIGRATION_ALREADY_PREPARED", INIT); return; }
  if (fs.existsSync(LOCK) && !/provider\s*=\s*"postgresql"/.test(fs.readFileSync(LOCK, "utf8"))) fail("Migration lock provider differs");
  child("npm", ["exec", "--workspace=@acme/db", "--", "prisma", "validate"], { DATABASE_URL: url });
  // Prisma CLI 6.19.x requires the explicit datamodel source flag. --to-schema
  // is not accepted by the installed CLI, despite examples using that alias.
  const sql = child("npm", PRISMA_DIFF_ARGS, { DATABASE_URL: url }, true);
  if (!sql.includes('CREATE TABLE "Storefront"') || !sql.includes('CREATE TABLE "Organization"')) fail("Prisma output lacked canonical tables");
  if (/\bDROP\s+(SCHEMA|TABLE|DATABASE)\b|\bTRUNCATE\b/i.test(sql)) fail("Unsafe initial diff");
  const checks = fs.readFileSync(CHECKS, "utf8");
  const contents = `-- CANONICAL_SCHEMA_SHA256 ${shaFile(PRISMA_SCHEMA)}\n-- CANONICAL_CHECKS_SHA256 ${shaFile(CHECKS)}\n${sql.trimEnd()}\n\n-- Canonical database invariants\n${checks.trimEnd()}\n`;
  fs.mkdirSync(path.dirname(INIT), { recursive: true });
  fs.writeFileSync(INIT, sealCanonicalSql(contents, shaFile(PRISMA_SCHEMA), shaFile(CHECKS)), { flag: "wx" });
  if (!fs.existsSync(LOCK)) fs.writeFileSync(LOCK, 'provider = "postgresql"\n', { flag: "wx" });
  ensureMigration();
  console.log("INITIAL_MIGRATION_READY", INIT, "REVIEW_SQL_BEFORE_RESET");
}
const INSPECT_SQL = `
 SELECT current_database()::text AS database_name,
   EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='ziledigital') AS schema_exists,
   (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ziledigital') AS relation_count,
   (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='ziledigital' AND t.typtype='e') AS enum_count,
   (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ziledigital') AS function_count,
   (SELECT count(*)::int FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname='ziledigital') AS extension_count,
   to_regclass('"ziledigital"."Storefront"') IS NOT NULL AS storefront_present,
   to_regclass('"ziledigital"."_prisma_migrations"') IS NOT NULL AS migrations_present`;
const TARGET_INVENTORY_SQL = `
 SELECT kind, id FROM (
 SELECT 'relation'::text kind, (c.oid::text || ':' || c.relname) AS id FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ziledigital'
 UNION ALL SELECT 'enum', (t.oid::text || ':' || t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='ziledigital' AND t.typtype='e'
 UNION ALL SELECT 'function', (p.oid::text || ':' || p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ziledigital'
 ) q ORDER BY kind,id`;
const OUTSIDE_INVENTORY_SQL = `
 SELECT kind,id FROM (
 SELECT 'namespace'::text kind, n.oid::text AS id FROM pg_namespace n WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'relation', c.oid::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'type', t.oid::text FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'function', p.oid::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'constraint', k.oid::text FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'trigger', t.oid::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'rule', r.oid::text FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'policy', p.oid::text FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'extension', e.oid::text FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname<>'ziledigital' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
 ) q ORDER BY kind,id`;
async function status(prisma) {
  const [s] = await prisma.$queryRawUnsafe(INSPECT_SQL);
  if (!s || s.database_name !== DB_NAME) fail("Database identity changed; refusing");
  return s;
}
async function targetFingerprint(prisma) {
  const records = await prisma.$queryRawUnsafe(TARGET_INVENTORY_SQL);
  return sha(JSON.stringify(records));
}
async function inspect(prisma) {
  const s = await status(prisma);
  console.log(`DATABASE ${s.database_name} SCHEMA ${SCHEMA} exists=${s.schema_exists} relations=${s.relation_count} enums=${s.enum_count} functions=${s.function_count} extensions=${s.extension_count} Storefront=${s.storefront_present} migrations=${s.migrations_present}`);
  const objects = await prisma.$queryRawUnsafe(`SELECT c.relname::text AS object, c.relkind::text AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ziledigital' ORDER BY c.relname LIMIT 35`);
  if (objects.length) console.table(objects);
  return s;
}
function backupFilename() { return `ziledigital-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}.dump`; }
async function backup(prisma, config) {
  const s = await status(prisma);
  if (!s.schema_exists) fail("Target schema is absent; no legacy schema to back up");
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const dest = path.join(BACKUP_DIR, backupFilename());
  const fd = fs.openSync(dest, "wx", 0o600); fs.closeSync(fd);
  try {
    child("pg_dump", ["--format=custom", `--schema=${SCHEMA}`, "--no-owner", "--no-acl", `--file=${dest}`], pgEnv(config.u));
    child("pg_restore", ["--list", dest], {}, true);
    const metadata = {
      database: DB_NAME,
      schema: SCHEMA,
      identity: config.identity,
      createdAt: new Date().toISOString(),
      backup: dest,
      backupSha256: shaFile(dest),
      schemaInventorySha256: await targetFingerprint(prisma),
    };
    fs.writeFileSync(`${dest}.json`, JSON.stringify(metadata, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    fs.writeFileSync(LATEST, JSON.stringify({ metadata: `${dest}.json` }) + "\n", { mode: 0o600 });
    console.log("VERIFIED_SCHEMA_BACKUP", dest);
    console.log("BACKUP_SHA256", metadata.backupSha256);
    return metadata;
  } catch (err) { try { fs.unlinkSync(dest); } catch {} throw err; }
}
function checkedBackup(config) {
  if (!fs.existsSync(LATEST)) fail("No verified backup recorded; run backup first");
  const latest = JSON.parse(fs.readFileSync(LATEST, "utf8"));
  const file = path.resolve(latest.metadata || "");
  if (!file.startsWith(`${BACKUP_DIR}${path.sep}`)) fail("Backup metadata path outside protected directory");
  const m = JSON.parse(fs.readFileSync(file, "utf8"));
  if (m.database !== DB_NAME || m.schema !== SCHEMA || m.identity !== config.identity) fail("Backup belongs to another database connection");
  if (path.resolve(m.backup) !== file.replace(/\.json$/, "")) fail("Backup metadata/file mismatch");
  if (!fs.statSync(m.backup).isFile() || shaFile(m.backup) !== m.backupSha256) fail("Backup file changed after verification");
  if (Date.now() - Date.parse(m.createdAt) > 60 * 60 * 1000 || Date.now() < Date.parse(m.createdAt)) fail("Backup is over one hour old; run backup again");
  return m;
}
// Users may explicitly discard disposable local development data without installing
// PostgreSQL client tools. This path NEVER works on a remote server, even if the
// normal remote development acknowledgment is configured.
const DISCARD_CONFIRM = `DISCARD ALL LEGACY DEV DATA ${DB_NAME}.${SCHEMA}`;
function approvedLocalDevDiscard(config, argv = process.argv, env = process.env) {
  if (!argv.includes("--discard-legacy-dev-data")) return false;
  if (!argv.includes(`--confirm=${CONFIRM}`)) fail(`Explicit reset confirmation required: --confirm="${CONFIRM}"`);
  if (!argv.includes(`--acknowledge=${DISCARD_CONFIRM}`)) fail(`Permanent data loss acknowledgment required: --acknowledge="${DISCARD_CONFIRM}"`);
  const host = config.u.hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) fail("Discard without backup requires a local PostgreSQL connection; remote targets refused");
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production" || env.ZILEDIGITAL_ENV === "production") {
    fail("Discard without backup is prohibited in production environments");
  }
  if (config.u.searchParams.get("schema") !== SCHEMA || decodeURIComponent(config.u.pathname.slice(1)) !== DB_NAME) {
    fail("Discard target is not the approved local development schema");
  }
  return true;
}
async function reset(prisma, config) {
  ensureMigration();
  const wanted = `--confirm=${CONFIRM}`;
  if (!process.argv.includes(wanted)) fail(`Explicit acknowledgement required: --confirm="${CONFIRM}"`);
  const discardWithoutBackup = approvedLocalDevDiscard(config);
  const m = discardWithoutBackup ? null : checkedBackup(config);
  const before = await status(prisma);
  if (before.extension_count) fail("Extension owned by target schema; manual DBA review required");
  if (before.storefront_present || before.migrations_present) fail("Canonical tables/migrations already exist; refusing to reset");
  const nowInventory = await targetFingerprint(prisma);
  if (m && nowInventory !== m.schemaInventorySha256) fail("Schema objects changed since backup; back up again");
  // Atomically confirm DROP CASCADE cannot delete objects in other schemas.
  // Recheck the target inventory inside the same transaction before dropping.
  await prisma.$transaction(async (tx) => {
    if (await targetFingerprint(tx) !== nowInventory) fail("Target schema changed during reset preflight; transaction rolled back");
    const outsideBefore = await tx.$queryRawUnsafe(OUTSIDE_INVENTORY_SQL);
    if (before.schema_exists) await tx.$executeRawUnsafe('DROP SCHEMA "ziledigital" CASCADE');
    const outsideAfter = await tx.$queryRawUnsafe(OUTSIDE_INVENTORY_SQL);
    if (JSON.stringify(outsideBefore) !== JSON.stringify(outsideAfter)) fail("Reset would remove objects outside ziledigital; transaction rolled back");
    await tx.$executeRawUnsafe('CREATE SCHEMA "ziledigital"');
  }, { maxWait: 15000, timeout: 120000 });
  const s = await status(prisma);
  if (!s.schema_exists || s.relation_count || s.enum_count || s.function_count || s.extension_count) fail("Schema reset did not leave the target empty");
  console.log("EMPTY_CANONICAL_SCHEMA_READY", `${DB_NAME}.${SCHEMA}`);
  if (discardWithoutBackup) console.log("LEGACY_DEV_DATA_DISCARDED_WITHOUT_BACKUP", `${DB_NAME}.${SCHEMA}`);
  else console.log("BACKUP_RETAINED", m.backup);
}
async function initEmpty(prisma) {
  if (!process.argv.includes("--fresh-only")) fail("Explicit --fresh-only flag required");
  ensureMigration();
  const s = await status(prisma);
  if (s.relation_count || s.enum_count || s.function_count || s.extension_count) fail("Target schema is populated; use verified backup + reset instead");
  if (!s.schema_exists) {
    await prisma.$executeRawUnsafe('CREATE SCHEMA "ziledigital"');
    console.log("CREATED_EMPTY_DEV_SCHEMA", `${DB_NAME}.${SCHEMA}`);
  } else console.log("DEV_SCHEMA_ALREADY_EMPTY");
}
async function apply(prisma, config) {
  if (!process.argv.includes("--fresh-only")) fail("Explicit --fresh-only flag required");
  ensureMigration();
  const s = await status(prisma);
  if (!s.schema_exists || s.relation_count || s.enum_count || s.function_count || s.extension_count) fail("Refusing migration deployment: target schema must be empty");
  child("npm", ["exec", "--workspace=@acme/db", "--", "prisma", "migrate", "deploy"], { DATABASE_URL: config.url });
  await verify(prisma);
  console.log("CANONICAL_INPLACE_MIGRATION_PASS");
}
async function verify(prisma) {
  const s = await status(prisma);
  if (!s.storefront_present || !s.migrations_present) fail("Canonical Storefront or Prisma migration history missing");
  const constraints = await prisma.$queryRawUnsafe(`SELECT conname::text AS name FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='ziledigital' AND conname='ProductVariant_priceMinor_nonnegative'`);
  if (!constraints.length) fail("Canonical price constraint missing");
  const migration = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "ziledigital"."_prisma_migrations" WHERE migration_name='0001_initial' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`);
  if (!migration.length || migration[0].count !== 1) fail("Canonical initial migration not completed");
  console.log("CANONICAL_INPLACE_DB_VERIFY_PASS");
}
async function seed(prisma) {
  if (!process.argv.includes("--dev-only")) fail("Explicit --dev-only flag required");
  await verify(prisma);
  // Only seed empty development identities: never override actual merchants.
  const count = await prisma.organization.count();
  if (count !== 0) fail("Organization records already exist; refusing to seed example merchants");
  const orgs = [
    { slug: "ziledigital", name: "ZileDigital", storeSlug: "ziledigital", storeName: "ZileDigital Store" },
    { slug: "jeanyvesart", name: "JeanYvesArt", storeSlug: "jeanyvesart", storeName: "JeanYvesArt Store" },
  ];
  const made = await prisma.$transaction(async tx => {
    const rows = [];
    for (const org of orgs) {
      const created = await tx.organization.create({ data: { slug: org.slug, name: org.name } });
      const store = await tx.storefront.create({ data: { organizationId: created.id, slug: org.storeSlug, name: org.storeName, published: false } });
      rows.push({ slug: org.slug, storeId: store.id });
    }
    return rows;
  });
  for (const row of made) console.log("CREATED_DRAFT_DEV_STORE", row.slug, row.storeId);
  console.log("CANONICAL_DRAFT_DEV_STORES_SEEDED; NO HOSTNAMES VERIFIED; NO STORES PUBLISHED");
}
async function main() {
  if (["help", "--help"].includes(mode)) {
    console.log("Usage: node scripts/dev/canonical-inplace-db.cjs inspect|inspect-migrations|archive-inert-migrations|prepare|seal|backup|reset|init|apply|verify|seed");
    console.log("reset requires --confirm=\"RESET haitian_art_store.ziledigital\" after backup; alternatively specify --discard-legacy-dev-data and --acknowledge=\"DISCARD ALL LEGACY DEV DATA haitian_art_store.ziledigital\" on local development only");
    console.log("apply requires --fresh-only; seed requires --dev-only");
    console.log("Targets EXISTING local development database haitian_art_store and schema ziledigital; never drops a database");
    return;
  }
  if (!["inspect", "inspect-migrations", "archive-inert-migrations", "prepare", "seal", "backup", "reset", "init", "apply", "verify", "seed"].includes(mode)) fail("Unknown command");
  if (mode === "inspect-migrations") { printMigrationInventory(); return; }
  const config = loadConfig();
  if (mode === "archive-inert-migrations") {
    const confirmation = process.argv.find(a => a.startsWith("--confirm="));
    if (confirmation !== `--confirm=${MIGRATION_ARCHIVE_CONFIRM}`) fail(`Explicit acknowledgement required: --confirm=\"${MIGRATION_ARCHIVE_CONFIRM}\"`);
    archiveInertMigrations();
    return;
  }
  if (mode === "prepare") { prepare(config.url); return; }
  if (mode === "seal") { sealInitialMigration(); return; }
  const prisma = prismaDb(config.url);
  try {
    if (mode === "inspect") await inspect(prisma);
    if (mode === "backup") await backup(prisma, config);
    if (mode === "reset") await reset(prisma, config);
    if (mode === "init") await initEmpty(prisma);
    if (mode === "apply") await apply(prisma, config);
    if (mode === "verify") await verify(prisma);
    if (mode === "seed") await seed(prisma);
  } finally { await prisma.$disconnect(); }
}
if (require.main === module) main().catch(e => { console.error(`REFUSED: ${e.message}`); process.exitCode = 1; });
module.exports = { getUrl, sha, CONFIRM, DISCARD_CONFIRM, approvedLocalDevDiscard, resolveDatabaseUrl, DATABASE_ENV_DIRS, migrationInventory, archiveInertMigrations, MIGRATION_ARCHIVE_CONFIRM, PRISMA_DIFF_ARGS, TARGET_SEARCH_PATH, sealCanonicalSql };
