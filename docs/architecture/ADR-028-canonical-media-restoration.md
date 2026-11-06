# ADR-028 — Restore rich Admin capabilities without legacy commerce persistence

Decision: keep the professional v27 merchant UI, the best old-admin interactions and Cloudinary as the **media provider**. No resurrection of the old `Product` file URL arrays, global admin product endpoints, or obsolete Prisma columns.

## Current batch — operational media and sizes

- Public product images: server-authenticated upload; PNG/JPEG/WebP byte sniff; 12 MiB/file; Cloudinary `image/upload`; incoming resize and `PREVIEW` text overlay **before storing**; canonical `MediaAsset.private=false` + `ProductMedia` link with ordering.
- Private deliverables: server-authenticated upload of PDF, ZIP, SVG, PNG/JPEG/WebP; 40 MiB/file; Cloudinary `raw/authenticated`; canonical `MediaAsset.private=true` and `DigitalFile` tied to a DIGITAL variant. No download access route is added: existing entitlement-based download workflow still needs an independently audited signed-delivery implementation.
- Public image delivery: `GET /v1/stores/{storeId}/media/{assetId}` redirects only when the store, listing and product are all published and the asset is explicitly public. The old catalogue's `publicMedia.assetId` references this URL; never use raw Cloudinary keys in public JSON.
- Admin gallery previews: signed-in merchant route, tenant-scoped and asset-to-product scoped. Private digital files expose names and MIME types to authorized merchant UI, never download URLs or tokens.
- Physical/digital variant `attributes.size` is managed with the existing canonical JSON field, not a new global `Product.sizes` array.
- No migration: `MediaAsset`, `ProductMedia`, `DigitalFile`, and `ProductVariant.attributes` already exist in canonical `0001_initial`.

## Explicitly not in this batch

- Image removal/replacement, drag-to-sort, cropping tools, custom per-store watermark overlay configuration, asset lifecycle garbage collection, security scanning for arbitrary raw attachments, optimized image transformations or upload queue.
- Actual buyer delivery and private download URLs: must be gated by paid entitlements, ownership and signed short-lived links.
- Full inventory management, category editor, richer sizes/material/print dimension rules, product discount/sale schedules, organization customer/user admin, orders, returns, Printful/provider integrations, and Favorites. Reintroduce each as org/store-scoped features in later batches, using reusable UI components from the old Admin.
- 12/40 MiB are application-level file validation; add request-size limits on the ingress/reverse proxy in production. `request.formData()` buffers multipart bodies; do not deploy publicly without an upstream body-size limit and rate limiting.
- The current PREVIEW watermark is a generic development safeguard, not per-store branding. Artwork rights and watermarks should be merchant-specific policy before production.

## Security rules

1. `requireMerchantPrincipal` and `requireMerchantAccess(capability=manage)` before upload/cloud storage side effects. A mere `productId` or `organizationId` is not authorization.
2. Origin check on credentialed multipart POST; only safe file signatures; never trust content-type or client file name; non-executable preview formats only.
3. Private raw Cloudinary files are uploaded using `type: authenticated`. They are not served by the public media route, gallery, CDN redirect, or API response.
4. Cloudinary secrets are never shipped to the storefront or serialized by Next.js.
5. No checkout activation. Audit and acceptance tests must pass before production use.

## Environment

Configure `CLOUDINARY_URL` or all three `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` as server-only environment values for both Admin and Commerce API runtime. Do not commit credentials. The Admin API writes; Commerce API generates public-image delivery URLs. A database connection still uses the existing canonical `haitian_art_store.ziledigital` schema.

## Validation checklist

- Admin/Commerce API builds and TypeScript checks; core catalog and tenant unit tests.
- Test upload PNG/JPEG/WebP with actual Cloudinary test credentials; published product image redirects only on its own store, never on another store.
- Test oversize, invalid bytes, mismatched Origin, nonexistent/wrong-tenant product, wrong-tenant digital variant, unauthorized user, private asset ID via public route.
- Test DIGITAL files are not exposed by any product response or image route; private entitlement download stays disabled.
- Confirm generated old `.next/types` were purged after deleting legacy Admin routes; rebuild fresh.
