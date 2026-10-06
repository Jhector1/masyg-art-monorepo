import { createAuthOptions } from "./createAuthOptions";

const hasGoogle = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
);
const hasKeycloak = Boolean(
  process.env.KEYCLOAK_CLIENT_ID?.trim() &&
    process.env.KEYCLOAK_CLIENT_SECRET?.trim() &&
    process.env.KEYCLOAK_ISSUER?.trim(),
);
const isSsoRelyingParty = Boolean(process.env.CUSTOMER_SSO_BROKER_ORIGIN?.trim());

/**
 * Canonical customer auth contract for every public storefront.
 *
 * Each storefront gets its own host-only NextAuth cookie and its own
 * NEXTAUTH_SECRET. Cross-domain SSO comes from the common identity provider,
 * never by copying a session cookie between domains.
 */
export const authOptions = createAuthOptions({
  signInPage: "/authenticate",
  // The broker owns interactive customer login. A relying storefront accepts
  // only one-time SSO handoffs, so direct provider URLs cannot create a local-
  // only identity that bypasses the shared customer session.
  enableCredentials: !isSsoRelyingParty,
  enableGoogle: !isSsoRelyingParty && hasGoogle,
  enableKeycloak: !isSsoRelyingParty && hasKeycloak,
  enableGuestClaim: true,
  enableSsoHandoff: true,
});
