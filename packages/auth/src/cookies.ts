const CUSTOMER_COOKIE_TTL_SEC = 7 * 24 * 60 * 60;
const OAUTH_TRANSIENT_TTL_SEC = 15 * 60;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function sanitizeCookiePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function resolveCustomerCookieNamespace() {
  const configured = process.env.CUSTOMER_AUTH_COOKIE_NAMESPACE?.trim();
  if (configured) return sanitizeCookiePart(configured);

  const authUrl = process.env.NEXTAUTH_URL?.trim();
  if (authUrl) {
    try {
      const url = new URL(authUrl);
      const host = sanitizeCookiePart(url.host);
      if (host) return `zd-customer-${host}`;
    } catch {
      // Fall through to a stable customer namespace.
    }
  }

  return "zd-customer";
}

function cookieName(suffix: string) {
  const prefix = isProduction() ? "__Host-" : "";
  return `${prefix}${resolveCustomerCookieNamespace()}.${suffix}`;
}

export function getCustomerSessionCookieName() {
  return cookieName("session-token");
}

export function getCustomerAuthCookieNames() {
  return {
    sessionToken: getCustomerSessionCookieName(),
    callbackUrl: cookieName("callback-url"),
    csrfToken: cookieName("csrf-token"),
    pkceCodeVerifier: cookieName("pkce.code-verifier"),
    state: cookieName("state"),
    nonce: cookieName("nonce"),
  } as const;
}

export function getCustomerAuthCookies() {
  const secure = isProduction();
  const names = getCustomerAuthCookieNames();
  const base = { sameSite: "lax" as const, path: "/", secure };

  return {
    sessionToken: {
      name: names.sessionToken,
      options: {
        ...base,
        httpOnly: true,
        maxAge: CUSTOMER_COOKIE_TTL_SEC,
      },
    },
    callbackUrl: {
      name: names.callbackUrl,
      options: base,
    },
    csrfToken: {
      name: names.csrfToken,
      options: {
        ...base,
        httpOnly: true,
      },
    },
    pkceCodeVerifier: {
      name: names.pkceCodeVerifier,
      options: {
        ...base,
        httpOnly: true,
        maxAge: OAUTH_TRANSIENT_TTL_SEC,
      },
    },
    state: {
      name: names.state,
      options: {
        ...base,
        httpOnly: true,
        maxAge: OAUTH_TRANSIENT_TTL_SEC,
      },
    },
    nonce: {
      name: names.nonce,
      options: {
        ...base,
        httpOnly: true,
      },
    },
  };
}

export const CUSTOMER_SESSION_MAX_AGE_SEC = CUSTOMER_COOKIE_TTL_SEC;
