# ADR-029: Multi-page Merchant Admin and canonical gallery operations

Status: Development implementation, pending runtime acceptance.

## Decision

The previous all-in-one `/merchant` screen is replaced with dedicated Next.js routes:

- `/merchant`: overview;
- `/merchant/storefronts`: store publication;
- `/merchant/products`: searchable product library;
- `/merchant/products/new`: product and variant creation;
- `/merchant/products/[productId]?store=...`: tenant-scoped editing and galleries;
- `/merchant/media`: thumbnail overview by storefront.

A single server-only workspace selector resolves membership and store ownership. A direct product URL is authorized through an organization+store+product composite lookup before any product data is returned. Anonymous commerce APIs remain read-only. The old `MerchantCatalogConsole` mega-component is retired.

Product gallery cover is the first `ProductMedia` entry by `sortOrder`. The gallery patch validates that the ordered IDs are exactly the existing media IDs; mutations require an authenticated principal, organization manage capability, and same-origin request. Image removal detaches the image and attempts Cloudinary deletion for orphaned public previews; on remote failure, a cleanup-pending audit event is recorded. Digital originals remain private and cannot be deleted through the public-preview route.

Thumbnail redirects request a fixed 240x240 delivery transformation of the **already processed public preview**, never a private source file. This does not create a second media schema or legacy URL arrays.

Variant size, material, and edition format are stored in `ProductVariant.attributes`; no migration is required. Public product availability remains bound to inventory, not the photo gallery. Store publication does not activate checkout.

## Deferred capability gates

- Categories and product-category links need tenant-scoped CRUD and listing filters.
- Stock adjustments require consistent stock-level and reservation checks.
- New variants on an existing product need canonical creation/deletion rules and historical order protection.
- Prices, scheduled discounts, edition licensing and other commerce rules require versioned domain policies.
- Authenticated order/customer/team management need separate authorized endpoints.
- Digital downloads, payment settlement and private file deletion remain gated pending checkout and entitlement verification.
- Full server-side pagination for catalog/media beyond the current 50-item query and automated Cloudinary cleanup retries remain future work.
