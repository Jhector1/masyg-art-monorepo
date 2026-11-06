# ADR-031 — One Cloudinary estate, canonical organization-scoped media

## Ownership and organization
Cloudinary holds image bytes and transformations. PostgreSQL `MediaAsset`, `ProductMedia`, `StoreListing`, and `DigitalFile` determine ownership, product relationships, publication, variant attachment, and buyer entitlement. Never infer authorization from a Cloudinary folder or from a client-supplied `public_id`.

Existing stable public IDs: `ziledigital/{organizationId}/products/{productId}/preview/{uuid}` (image/upload) and `ziledigital/{organizationId}/products/{productId}/digital/{uuid}.{ext}` (raw/authenticated). Preserve these IDs across the v31 upgrade. Do not create duplicate copies per storefront; the same product can be listed in more than one storefront **within the same organization** via `StoreListing`. Cross-organization product links are never permitted.

Modern Cloudinary *dynamic folders* need `asset_folder`; the `public_id` path alone does **not** put the object inside that Media Library folder. Set `CLOUDINARY_DYNAMIC_FOLDERS=1` on the server for accounts confirmed to use dynamic folder mode. Fixed-folder accounts keep the existing public-ID-based layout without it. Cloudinary `tags` help operations, not authorization. Set this only after checking the account's folder mode. Credentials stay server-only; do not expose API secrets in the browser.

## Image editing and thumbnail security
The v31 editor provides a local source-image preview with rotation and numeric pixel coordinates for crop selection; visual drag-to-crop remains a future enhancement. Use original JPEG/PNG/WebP bytes supplied by the merchant. Crop/rotate first, then cap resolution and stamp PREVIEW as an incoming transform *before storage*. Generate 240px square thumbnails from these already watermarked preview images. Never publicly store full-resolution originals. On image replacement create a new immutable Cloudinary ID; atomically swap only the chosen gallery link, preserving `sortOrder` and `altText`. Delete the old public object after DB commit only if orphaned. Failed cleanup must enter auditable retry backlog. No unwatermark feature. Alt text is per-product in `ProductMedia` and exported in the public catalog.

## Digital file versions
Digital-file bytes use authenticated Cloudinary raw assets, never public delivery. Replacing a file creates a new `DigitalFile` and marks the earlier one retired. New cart, checkout, publication and catalog reads select only `retiredAt IS NULL`. Historical orders and buyer grants still reference the retired file and must keep functioning. No public API exposes private storage keys. Do not delete retired original bytes while any entitlement can reference them.

## Security and operational follow-ups
Merchant mutating routes require verified session, organization authorization, origin validation, and input size checks. Cloudinary cleanup failures are recorded for an operations retry worker; automated retries and buyer entitlement-gated signed download delivery remain independent release gates. Confirm in live tests that Cloudinary's incoming transformation actually produces a stamped image and signed authenticated originals return 401/403 without entitlement.

See Cloudinary official documentation for dynamic folder `asset_folder`, authenticated resources, and CDN invalidation semantics.
