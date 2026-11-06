# ADR-025 — API-first, language-independent commerce (accepted for development)

## Decision
A **modular monolith** remains the source of truth. Storefronts can be built in any
programming language or UI framework; they consume versioned JSON over HTTP.
The canonical commerce rules, tenant isolation and database stay in
`packages/core`, `packages/server` and `packages/db` for now. The new
`apps/commerce-api` is a **separately deployable HTTP facade**, not a second
commerce service or database. Storefront Next.js adapters are temporary
integration surfaces during migration, not the final dependency for consumers.

## v25 implemented scope
- Standalone Next.js API-only app, `/v1/stores/{storeId}/products` and
  `/v1/stores/{storeId}/products/{slug}`, reusing canonical server handlers.
- OpenAPI 3.1 JSON contract in `contracts/openapi/commerce-public-v1.json`.
- Anonymous published-only catalog GET; one explicitly restricted CORS policy,
  never allowing credentials. Public preview asset IDs are not asset URLs.
- Liveness endpoint `/v1/health` (does *not* check DB readiness).
- No new schema, tenant authorization, business logic or payment path.
- Neither storefront is switched to this origin until an accessible API domain
  and rollout/integration tests are in place.

## Explicitly *not* done
- Cross-origin cookies, cart mutations, customer account/order reads, checkout,
  payment webhooks, signed media URLs, private downloads, merchant Admin access.
  These require dedicated session/CSRF and authentication strategy and
  organization-scoped authorization; wildcard CORS is forbidden for them.
- Production API DNS, TLS, proxy trusted-host rules, rate limiting, monitoring,
  abuse controls and security review. OpenAPI version is alpha.
- Moving source files between existing packages just for folder cosmetics.

## Identity, origin and tenant boundaries
Public catalog may use an explicit store ID because it returns only published
information. The core service resolves a published store and constrains its
listings by both `organizationId` and `storeId`. It never returns private
media storage keys. No `X-Forwarded-Host` or arbitrary caller-supplied
organization ID grants authorization.

For a future browser cart across custom domains, define a clear trusted API
origin, cookie partitioning/token scheme, CSRF policy, allowed-origin lookup,
merchant-to-store binding and credential transport. Reusing `credentials:
"same-origin"` clients against another origin **does not work as-is**.

## Versioning and API contracts
- `/v1` governs HTTP wire shape; breaking changes require a new major path.
- Publish OpenAPI for Python, PHP, Java, JavaScript or other HTTP clients;
  no TypeScript dependency should be required by consumers.
- Catalog product/variant data exposes server pricing in integer minor units.
- Keep locale (translation) separate from tenant identity. Localized content
  and messages are a later contract, not inferred from the request host.

## Acceptance gates before any production route
1. `npm install` synchronizes workspace lock file with new `commerce-api` app.
2. API app `check-types` and `build` pass; public route smoke test passes.
3. Positive published-store response and unpublished/cross-org not-found tests
   against isolated PostgreSQL, including independent domains.
4. Browser cross-origin public catalog request from a separate frontend.
5. No credentialed CORS on any private/write endpoint.
6. Three storefront/Admin existing builds and static architecture audit remain
   checked; checkout and private downloads stay disabled.
