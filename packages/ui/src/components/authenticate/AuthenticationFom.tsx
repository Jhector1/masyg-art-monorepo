"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useUser } from "@acme/core/contexts/UserContext";
import Image from "next/image";

// -------------------------------
// Links to legal pages (adjust)
// -------------------------------
const TERMS_URL = "/terms-of-use";
const PRIVACY_URL = "/privacy-policy";

interface AuthenticationFormProps {
  onSuccess?: () => Promise<void> | void;
  handlerAction?: () => void;
  isGuest?: boolean;
  callbackUrl?: string; // relative path preferred (starts with "/")
}

const ERROR_MAP: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  OAuthSignin: "Could not sign in with the provider.",
  OAuthCallback: "The provider did not authorize this login.",
  OAuthAccountNotLinked:
    "Account already exists with a different sign-in method.",
  default: "Login failed. Please try again.",
};

export default function AuthenticationForm({
  onSuccess,
  handlerAction = () => {},
  isGuest = false, // ← default to showing guest
  callbackUrl,
}: AuthenticationFormProps) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { loginWithCredentials, loginWithProvider, isAuthBusy } = useUser();

  const safeCb = useMemo(() => {
    if (!callbackUrl) return pathname || "/profile";
    try {
      const u = new URL(callbackUrl, "http://dummy");
      return u.pathname + u.search + u.hash;
    } catch {
      return callbackUrl.startsWith("/") ? callbackUrl : pathname || "/profile";
    }
  }, [callbackUrl, pathname]);

  // ✅ Guest: issue a guest_id cookie (30d), reload only when creating new
  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const match = document.cookie.match(/(?:^|;\s*)guest_id=([^;]+)/);
      if (!match) {
        const uuid = crypto.randomUUID();
        const secure = location.protocol === "https:" ? "; Secure" : "";
        document.cookie =
          `guest_id=${uuid}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax${secure}`;
        // ensure server sees the cookie immediately
        location.assign(safeCb || "/");
        return; // stop here, page navigation will occur
      }
      // already have a guest, proceed without reload
      handlerAction?.();
      onSuccess?.();
    } catch (err) {
      // ignore; guest path is best-effort
      handlerAction?.();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!acceptPolicy) {
          throw new Error("You must agree to the Terms and Privacy Policy.");
        }

        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            email,
            password,
            acceptPolicy,
          }),
        });
        if (!res.ok) {
          const { error: msg } = await res.json().catch(() => ({ error: "" }));
          throw new Error(msg || "Signup failed");
        }
      }

      const result = await loginWithCredentials({
        email,
        password,
        callbackUrl: safeCb,
      });

      if (!result.ok) {
        setError(ERROR_MAP[result.error] ?? ERROR_MAP.default);
        return;
      }

      await onSuccess?.();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.4 } },
  };
  const formVariants = {
    hidden: { x: mode === "login" ? -50 : 50, opacity: 0 },
    show: { x: 0, opacity: 1, transition: { duration: 0.5 } },
    exit: {
      x: mode === "login" ? 50 : -50,
      opacity: 0,
      transition: { duration: 0.3 },
    },
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-2xl shadow-xl dark:bg-neutral-900">
      <motion.div
        className="flex justify-center mb-6 bg-gray-100 dark:bg-neutral-800 rounded-full p-1"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`px-6 py-2 rounded-full font-medium transition-all focus:outline-none ${
              mode === m
                ? "bg-white dark:bg-neutral-900 shadow-lg"
                : "text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {m === "login" ? "Login" : "Sign Up"}
          </button>
        ))}
      </motion.div>

      {error && (
        <p className="text-red-500 text-center mb-4" role="alert">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.form
          key={mode}
          onSubmit={handleSubmit}
          variants={formVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          className="space-y-4"
        >
          {mode === "signup" && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              placeholder="Full Name"
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-400 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              required
            />
          )}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-400 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            required
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-400 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {mode === "signup" && (
            <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-neutral-200 select-none">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-neutral-600"
                checked={acceptPolicy}
                onChange={(e) => setAcceptPolicy(e.target.checked)}
                aria-describedby="policy-help"
                required
              />
              <span id="policy-help">
                I have read and agree to the{" "}
                <a
                  href={TERMS_URL}
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href={PRIVACY_URL}
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading || isAuthBusy || (mode === "signup" && !acceptPolicy)}
            className={`w-full py-2 rounded-md transition ${
              mode === "login"
                ? "bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                : `bg-pink-500 text-white ${
                    mode === "signup" && !acceptPolicy
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:bg-pink-600"
                  }`
            }`}
          >
            {loading || isAuthBusy
              ? "Please wait..."
              : mode === "login"
              ? "Log In"
              : "Sign Up"}
          </button>
        </motion.form>
      </AnimatePresence>

      {/* Universal disclosure under email auth */}
      <p className="mt-3 text-xs text-center text-gray-500 dark:text-neutral-400">
        By continuing, you agree to our{" "}
        <a
          href={TERMS_URL}
          className="text-indigo-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href={PRIVACY_URL}
          className="text-indigo-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>
        .
      </p>

      <motion.div
        className="mt-6 text-center text-gray-500 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.4 } }}
      >
        Or
      </motion.div>

      <motion.div
        className="mt-4 space-y-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.6 } }}
      >
        <GoogleContinueButton
          loading={isAuthBusy}
          onClick={() =>
            loginWithProvider({ provider: "google", callbackUrl: safeCb })
          }
        />
        {/* Disclosure for OAuth */}
        <p className="text-xs text-center text-gray-500 dark:text-neutral-400">
          By continuing with Google, you agree to our{" "}
          <a
            href={TERMS_URL}
            className="text-indigo-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href={PRIVACY_URL}
            className="text-indigo-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>
          .
        </p>

        {/* ✅ Guest path */}
        {isGuest && (
          <>
            <GuestContinueButton
              loading={isAuthBusy}
              onClick={(e) => handleGuestLogin(e as any)}
            />
            <p className="text-xs text-center text-gray-500 dark:text-neutral-400">
              We’ll create a temporary guest profile on this device. You can
              make an account later to sync purchases.
            </p>
          </>
        )}
      </motion.div>

      <motion.div
        className="mt-6 text-center text-gray-500 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.8 } }}
      >
        {mode === "login" ? "Don't have an account?" : "Already have an account?"}
        <button
          className="ml-1 text-indigo-500 hover:underline focus:outline-none"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          type="button"
        >
          {mode === "login" ? "Sign Up" : "Log In"}
        </button>
      </motion.div>
    </div>
  );
}

/* ============================================================
   GoogleContinueButton (inline for convenience)
   ============================================================ */

type GoogleButtonProps = {
  onClick: () => Promise<void> | void;
  loading?: boolean;
  className?: string;
  label?: string;
};

function GoogleContinueButton({
  onClick,
  loading = false,
  className = "",
  label = "Continue with Google",
}: GoogleButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        if (!loading) onClick();
      }}
      aria-label={label}
      aria-busy={loading}
      disabled={loading}
      className={[
        "group relative w-full inline-flex items-center justify-center gap-3",
        "rounded-xl border border-gray-300/80 bg-white px-4 py-3",
        "shadow-sm transition-all",
        "hover:shadow-md hover:border-gray-300",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100",
        pressed ? "shadow-none" : "",
        className,
      ].join(" ")}
    >
      <Image
        src="/google-icon.png"
        alt="Google logo"
        width={20}
        height={20}
        className="shrink-0"
      />
      <span className="text-sm font-medium text-gray-800 dark:text-neutral-100">
        {loading ? "Connecting to Google…" : label}
      </span>
      <span
        className="absolute right-3 opacity-0 translate-x-0.5 transition-all group-hover:opacity-100 group-hover:translate-x-0"
        aria-hidden="true"
      >
        →
      </span>
    </motion.button>
  );
}

/* ============================================================
   GuestContinueButton
   ============================================================ */

type GuestButtonProps = {
  onClick: (e: React.FormEvent) => void;
  loading?: boolean;
  className?: string;
  label?: string;
};

function GuestContinueButton({
  onClick,
  loading = false,
  className = "",
  label = "Continue as Guest",
}: GuestButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      whileTap={{ scale: 0.98 }}
      onClick={(e) => {
        if (!loading) onClick(e);
      }}
      aria-label={label}
      aria-busy={loading}
      disabled={loading}
      className={[
        "group relative w-full inline-flex items-center justify-center gap-3",
        "rounded-xl border border-gray-300/80 bg-white px-4 py-3",
        "shadow-sm transition-all",
        "hover:shadow-md hover:border-gray-300",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100",
        pressed ? "shadow-none" : "",
        className,
      ].join(" ")}
    >
      {/* simple user icon circle */}
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs"
      >
        G
      </span>
      <span className="text-sm font-medium text-gray-800 dark:text-neutral-100">
        {loading ? "Preparing guest…" : label}
      </span>
      <span
        className="absolute right-3 opacity-0 translate-x-0.5 transition-all group-hover:opacity-100 group-hover:translate-x-0"
        aria-hidden="true"
      >
        →
      </span>
    </motion.button>
  );
}
