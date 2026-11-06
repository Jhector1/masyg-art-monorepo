# ADR-027 — Restore Admin experience on canonical merchant APIs

Status: development implementation. No payment activation.

## Why

The pre-migration Admin offered useful affordances (searchable product cards, a richer product editor, variant pricing, media and upload entry points, responsive navigation). Its old Prisma models and global API routes were unsafe to resurrect after the canonical tenant-scoped database migration. v26 intentionally shipped a narrow test console to prove publication, but that console should not become the permanent merchant experience.

## Decision

- Keep the original shared Admin header and core layout design, adapt navigation to the merchant role and actual page sections.
- Use only server-verified `/api/merchant/organizations/:organizationId/...` routes for merchant mutations, with the existing ownership and store grant checks. Never pass or trust a buyer/merchant user ID from the browser.
- Restore product-card browsing, client filtering across the latest 50 listings, inline title/description editor, multiple-variant draft creation, variant price/availability editor, archive confirmation, and separate catalog/listing/store publication.
- Add the variant PATCH adapter to the canonical `updateCatalogVariant` service. There are no browser-side Prisma calls, platform emergency-admin bypass, or legacy product endpoint imports.
- Preserve draft-only behavior for digital products lacking private files, physical tracked stock at zero until inventory is available, and checkout disabled.
- Do not pretend media uploads, category management, full catalog pagination, or inventory write workflows are implemented; leave explicit information until their canonical tenant-scoped APIs are built.

## Scope and limitations

- No database migration. No change to v25 public catalog contract.
- No restoration of deleted global Admin routes, services, or old Prisma models.
- No direct image upload in this batch. Storage integration must have organization-owned media objects, safe file validation, access controls, and private-by-default digital assets.
- Existing merchant write origin/CSRF middleware remains the enforcement point. Production deployment must also configure authentication cookies/origins correctly.
- Client-side search currently filters only 50 most recent listings from the shared `listMerchantProducts` boundary. Add server pagination and durable search in a later batch.
- Test against two organizations: a nonowner must not edit another owner's variants, products or store state; an editor cannot manage organization-wide catalog data.
