# ADR-033 — Merchant operational workflows (v33)

## Context
v32 introduced read-only Orders and Customers plus owner-managed Staff, but not operational write workflows.
User-provided screen recording confirms the dedicated navigation works; it does not establish payment/refund or Cloudinary live success.

## Decisions
1. Staff invitations are *not* immediate grants. Only an organization OWNER creates/revokes them. No invitation can directly confer OWNER. Expiring 256-bit tokens are never stored or returned by an HTTP API, only their SHA-256 hashes; the email link uses a URL fragment to avoid sending it to HTTP logs. Signed-in acceptance requires an exact normalized invited email, and consumes the invitation inside a serializable membership transaction. MEMBER receives only one explicit VIEWER store grant. Existing direct account enrollment remains separate.
2. Email send is opt-in with `RESEND_API_KEY`, `ZILEDIGITAL_INVITE_FROM`, `ZILEDIGITAL_ADMIN_ORIGIN` on the Admin server. Delivery without configuration is rejected before DB creation. A failed send records FAILED; no access is granted. Mail provider may retain email body, which includes the invitation link; provider account security matters. Delivery is not confirmed until the provider responds. No background retries, queued invites, or promise of inbox delivery.
3. Customer notes are operator-only, scoped by organization, store and customer purchase history; note bodies are never sent to customer-facing APIs. Audit log stores identifiers, not note contents. Notes are append-only in v33.
4. Shipment plans are **PENDING**, and can only be prepared for a paid/fulfilling physical order. Quantity constraints are revalidated inside a serializable transaction; request IDs are hashed for retry idempotency and payload fingerprints prevent mismatched replays. Planning does NOT mark shipped, update order/payment state, move inventory, consume holds, or issue refunds. Shipment confirmation is a later provider/stock-aware workflow.
5. v33 adds schema migration 0004, no destructive change. Existing purchases and media records remain intact. Payment, refund, cancellation, and download entitlements are not modified by v33.
6. The 48 audit findings remain open. The cutover checker flags count regression and has a strict `--release` mode requiring zero. No release until clean and verified.

## Acceptance gates (different from unit/build checks)
- Real development PostgreSQL: two different organizations, owner/member, accepted/revoked/expired invites, rejected cross-organization IDs, store-scoped notes; verify no writes on denial. Use disposable test accounts and never email real customers.
- Email: configured verified sending domain; successful Resend message ID, receipt in invited inbox, acceptance with invited account, revocation and second-use rejection. Confirm token absent from API responses/logs.
- Shipment plan: create for one paid test order, retry same request ID, ensure exactly one PENDING record, reject overplanning and unpaid order. Confirm order status, stock holds, inventory, and payment rows are unchanged.
- Cloudinary v31: actual upload/crop/watermark, cross-tenant denial, preview deletion behavior and retired digital originals; not covered by v33 tests.
- Provider operations: real Stripe *test-mode* cancellation/refund, signed webhook reconciliation, inventory/hold settlement, and digital entitlements require separate implementation before exposing action buttons.
- Cutover audit: `python3 scripts/architecture/check-commerce-cutover-gate-v33.py --release` must pass with zero findings before production.

## Known limitations
No queue/outbox or retryable delivery worker; in rare mail/database partial failure, a link may be emailed but remain unaccepted. Invitation revoke/recreate is available to owners. No email signup flow is created by this patch. Acceptance requires a registered, signed-in account with the invited email; sign in on the same browser then return to the invitation tab. Multi-service concurrent serializable conflicts may require retry.
