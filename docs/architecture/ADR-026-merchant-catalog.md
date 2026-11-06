# ADR-026 — Canonical merchant catalog and storefront publication

## Scope
- Admin NextAuth credentials authenticate against canonical `User.passwordHash`.
  Platform admin allowlisting remains separate from `OrganizationMember` roles.
  An emergency admin cannot become a merchant principal.
- Merchant mutations use the current authenticated session, scoped authorization
  (`organizationId`, `storeId`) and same-origin JSON-only middleware policy.
- `POST /api/merchant/organizations/{orgId}/stores/{storeId}/products`
  creates **one product, its variants, a draft listing and an audit entry in
  a single transaction**; no client-submitted price is ever trusted at checkout.
- `POST /api/merchant/organizations/{orgId}/products/{productId}` publishes a
  catalog product only after its variant checks pass.
- `PATCH /api/merchant/organizations/{orgId}/stores/{storeId}/products/{productId}`
  publishes or unpublishes an individual listing.
- `PATCH /api/merchant/organizations/{orgId}/stores/{storeId}` toggles the store;
  it cannot be published without a published catalog listing.
- The merchant `/merchant` page uses the **same** handlers, no parallel business logic.
- Store publication and its audit entry are one database transaction.
- A local-only CLI can explicitly create a development credentials user and
  assign the two empty seeded organizations to that user. It is not used in production.

## Out of scope / still gated
- Public checkout and customer downloads remain disabled and unverified.
- Physical variants default to TRACKED inventory at zero stock, and therefore
  public catalog `available: false` until a real inventory operation is added.
- Digital products need private digital files before catalog publishing.
- Production merchant onboarding, email verification and live domain verification
  are separate security-reviewed milestones.
- Current client UI supports simple USD physical products only; canonical API
  supports other currencies and fulfillment variants.
- Use only the existing `haitian_art_store.ziledigital` development database;
  do not run migrations again for this batch. No schema changes in v26.
