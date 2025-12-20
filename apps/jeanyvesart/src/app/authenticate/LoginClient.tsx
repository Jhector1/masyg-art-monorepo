"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") || "/";

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Sign in</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Continue with your account.
      </p>

      <button
        onClick={() => signIn("keycloak", { callbackUrl })}
        style={btnStyle}
      >
        Continue with SSO
      </button>

      <button
        onClick={() => signIn("google", { callbackUrl })}
        className="google-btn"
      >
        <span className="google-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path
              fill="#EA4335"
              d="M24 9.5c3.5 0 6.3 1.4 8.4 3.3l6.2-6.2C34.9 3.4 29.8 1.5 24 1.5 14.9 1.5 7.1 6.7 3.3 14.2l7.3 5.7C12.3 13.9 17.7 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.5 24.5c0-1.6-.1-2.8-.4-4H24v7.6h12.7c-.5 3-2.3 5.6-5 7.4l7.7 6c4.5-4.2 7.1-10.3 7.1-17z"
            />
            <path
              fill="#FBBC05"
              d="M10.6 28.1c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.3-5.7C1.2 16.5 0 20.2 0 24c0 3.8 1.2 7.5 3.3 10.8l7.3-5.7z"
            />
            <path
              fill="#34A853"
              d="M24 46.5c5.8 0 10.7-1.9 14.3-5.2l-7.7-6c-2.1 1.4-4.8 2.2-6.6 2.2-6.3 0-11.7-4.4-13.4-10.4l-7.3 5.7C7.1 41.3 14.9 46.5 24 46.5z"
            />
          </svg>
        </span>

        <span className="google-text">Continue with Google</span>
      </button>
    </main>
  );
}

const btnStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  cursor: "pointer",
  fontWeight: 700,
  marginBottom: 12,
};
