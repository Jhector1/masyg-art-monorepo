const ADMIN_SESSION_MAX_AGE_SEC = 8 * 60 * 60;
const OAUTH_TRANSIENT_TTL_SEC = 15 * 60;

function secure() {
  return process.env.NODE_ENV === "production";
}

function name(suffix: string) {
  return `${secure() ? "__Host-" : ""}ziledigital-admin.${suffix}`;
}

export function getAdminSessionCookieName() {
  return name("session-token");
}

export function getAdminMfaCookieName() {
  return name("mfa");
}

export function getAdminAuthCookies() {
  const useSecure = secure();
  const base = { sameSite: "lax" as const, path: "/", secure: useSecure };

  return {
    sessionToken: {
      name: getAdminSessionCookieName(),
      options: {
        ...base,
        httpOnly: true,
        maxAge: ADMIN_SESSION_MAX_AGE_SEC,
      },
    },
    callbackUrl: {
      name: name("callback-url"),
      options: base,
    },
    csrfToken: {
      name: name("csrf-token"),
      options: { ...base, httpOnly: true },
    },
    pkceCodeVerifier: {
      name: name("pkce.code-verifier"),
      options: {
        ...base,
        httpOnly: true,
        maxAge: OAUTH_TRANSIENT_TTL_SEC,
      },
    },
    state: {
      name: name("state"),
      options: {
        ...base,
        httpOnly: true,
        maxAge: OAUTH_TRANSIENT_TTL_SEC,
      },
    },
    nonce: {
      name: name("nonce"),
      options: { ...base, httpOnly: true },
    },
  };
}

export const ADMIN_SESSION_MAX_AGE = ADMIN_SESSION_MAX_AGE_SEC;
