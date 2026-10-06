# Authentication boundaries

## Customer storefronts

ZileDigital and JeanYves share the same customer identity model and canonical
NextAuth implementation from `@acme/auth`, but they do **not** share a browser
session cookie.

This is intentional. The production storefronts are on different registrable
domains, so a browser cannot securely scope one cookie to both. Each storefront
uses:

- its own host-only session cookie (`__Host-...` in production),
- its own `NEXTAUTH_SECRET`,
- its own OAuth/OIDC client credentials,
- the same customer database identity,
- optionally the same Keycloak realm/issuer for seamless cross-domain SSO.

With a common identity provider, signing into the second storefront can be
near-seamless because the IdP already has a session, while the two applications
still keep independent application cookies and independent signing secrets.

## Admin

Admin is a separate trust boundary:

- separate NextAuth cookie namespace,
- host-only `__Host-...` cookies in production,
- separate `NEXTAUTH_SECRET`,
- separate Google/OIDC client,
- short admin session lifetime,
- MFA for normal admins,
- independently controlled emergency/break-glass credentials.

A customer session must never authorize an admin route. Storefront auth always
exposes `isAdmin=false`; administration belongs to `apps/admin` only.

## Legacy auth

`POST /api/auth/login` is intentionally disabled. Customer authentication must
use NextAuth. This removes the old parallel `JWT_SECRET` + `token` cookie system
and leaves one authoritative customer session mechanism.
