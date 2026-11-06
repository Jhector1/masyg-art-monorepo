#!/usr/bin/env node
"use strict";
/** Non-mutating PostgreSQL smoke check. Not a substitute for authenticated E2E.
 * Run only against the intended development DB; never print credentials. */
const { PrismaClient } = require("@prisma/client");
const url = new URL(process.env.DATABASE_URL || "");
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.pathname !== "/haitian_art_store") {
  throw new Error("DB PREFLIGHT REFUSED: not the expected local dev database");
}
(async () => {
  const db = new PrismaClient();
  try {
    const tables = await db.$queryRaw`SELECT to_regclass('ziledigital."StaffInvitation"')::text AS invitation, to_regclass('ziledigital."CustomerNote"')::text AS note`;
    if (!tables[0]?.invitation || !tables[0]?.note) throw new Error("v33 migration 0004 not applied");
    const stores = await db.storefront.findMany({ select: { id: true, organizationId: true }, take: 25 });
    const organizations = [...new Set(stores.map(store => store.organizationId))];
    if (organizations.length > 1) {
      for (const store of stores) {
        const foreign = organizations.find(id => id !== store.organizationId);
        const leaked = await db.storefront.findFirst({ where: { id: store.id, organizationId: foreign }, select: { id: true } });
        if (leaked) throw new Error("Scoped storefront query returned a foreign organization's store");
      }
    }
    console.log(`ZILEDIGITAL_V33_READONLY_DB_PREFLIGHT_PASS stores=${stores.length} organizationScopes=${organizations.length}`);
    console.log('NOTE: This checks query scoping and schema only; browser authentication, invitation delivery, Cloudinary, and provider refunds still require live tests.');
  } finally { await db.$disconnect(); }
})().catch(e=>{console.error(e instanceof Error?e.message:'DB preflight failed');process.exitCode=1;});
