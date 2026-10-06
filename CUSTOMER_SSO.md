# Customer SSO boundary

## Trust model

- `ziledigital.com` is the interactive customer-auth broker.
- JeanYves is a relying storefront with its own host-only NextAuth cookie.
- No cookie is shared between `ziledigital.com` and the JeanYves domain.
- Admin is not part of this SSO path and keeps its separate cookie, secret, MFA, and emergency login.

## Handoff

1. JeanYves sees no local customer session and performs one top-level SSO probe.
2. ZileDigital receives the probe with its own first-party cookie.
3. If the customer is logged in, ZileDigital creates a random 60-second code.
4. Only a SHA-256 hash of the code is stored in `VerificationToken`.
5. The code is bound to the exact target origin and user.
6. JeanYves exchanges it through the internal `customer-sso` Credentials provider.
7. The DB token is deleted atomically before the JeanYves session is returned.
8. Replays, expired codes, wrong audiences, and unapproved target origins fail closed.

If the customer is not logged into ZileDigital, an automatic probe returns to JeanYves without prompting. When the customer explicitly chooses Sign In on JeanYves, the broker login is forced and then hands the authenticated identity back.

## Required production environment

### ZileDigital

```env
NEXTAUTH_URL=https://ziledigital.com
CUSTOMER_SSO_ALLOWED_ORIGINS=https://YOUR-JEANYVES-ORIGIN
CUSTOMER_SSO_PEER_ORIGIN=https://YOUR-JEANYVES-ORIGIN
```

Do **not** set `CUSTOMER_SSO_BROKER_ORIGIN` on ZileDigital. The broker keeps its normal Credentials / Google / Keycloak providers.

### JeanYves

```env
NEXTAUTH_URL=https://YOUR-JEANYVES-ORIGIN
CUSTOMER_SSO_BROKER_ORIGIN=https://ziledigital.com
```

Setting `CUSTOMER_SSO_BROKER_ORIGIN` makes JeanYves a relying party: direct Credentials, Google, and Keycloak providers are disabled there, leaving only the one-time SSO handoff provider. This prevents users from creating a JeanYves-only customer session that ZileDigital does not know about.

### Admin

No customer SSO variables should be configured in `apps/admin`.

## Local development defaults

When `NODE_ENV` is not production:

- broker: `http://localhost:3001`
- JeanYves: `http://localhost:3002`
- allowed local origins: ports 3001 and 3002

Production never falls back to a permissive target allowlist.

## Logout

Customer logout is global across the two public storefronts. The browser visits both first-party origins in a short redirect chain so each host can expire its own cookie. Admin is not affected.
