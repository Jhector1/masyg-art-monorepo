// src/app/verify-2fa/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SendResult = {
  ok?: boolean;
  error?: string;
  alreadyActive?: boolean;
  throttled?: boolean;
  emailed?: boolean;
  expiresAt?: string;
};

const OTP_LENGTH = 6;

export default function Verify2FA() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/";

  // ----- UI State -----
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [focused, setFocused] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sentOnce, setSentOnce] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const expiresInSec = useCountdown(expiresAt);
  const cooldownSec = useCountdown(cooldownUntil);

  const code = useMemo(() => digits.join(""), [digits]);

  // ----- Effects -----
  // Auto-send once per tab (idempotent)
  useEffect(() => {
    const key = "mfa_sent";
    if (!sessionStorage.getItem(key)) {
      void send(); // fire & forget
      sessionStorage.setItem(key, "1");
    }
  }, []);

  // Focus movement
  useEffect(() => {
    inputsRef.current[focused]?.focus();
  }, [focused]);

  // ----- Handlers -----
  async function send(force = false) {
    setErr(null);
    setInfo(null);
    setSending(true);
    try {
      const r = await fetch(`/api/admin/2fa/send${force ? "?force=1" : ""}`, { method: "POST" });
      const data = (await r.json().catch(() => ({}))) as SendResult;

      // Parse Retry-After header for cooldown (seconds)
      const retryAfter = parseInt(r.headers.get("Retry-After") || "0", 10);
      if (retryAfter > 0) {
        setCooldownUntil(new Date(Date.now() + retryAfter * 1000));
      }

      if (!r.ok) {
        setErr(data?.error ?? "Failed to send code");
        return;
      }

      setSentOnce(true);

      if (data.expiresAt) {
        setExpiresAt(new Date(data.expiresAt));
      }

      if (data.alreadyActive) {
        setInfo("A verification code was already sent. Please check your inbox.");
      } else if (data.throttled) {
        setInfo("You can request another code shortly.");
      } else if (data.emailed === false) {
        setInfo("We generated a code, but emailing failed. Try Resend or contact support.");
      } else {
        setInfo("Verification code sent. Check your inbox.");
      }
    } catch (e) {
      setErr("Network error while sending code.");
    } finally {
      setSending(false);
    }
  }

  function handleChange(i: number, val: string) {
    setErr(null);
    setInfo(null);

    // Allow only digits; if pasting, distribute across boxes
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => {
        const copy = [...d];
        copy[i] = "";
        return copy;
      });
      return;
    }

    if (clean.length === 1) {
      setDigits((d) => {
        const copy = [...d];
        copy[i] = clean;
        return copy;
      });
      if (i < OTP_LENGTH - 1) setFocused(i + 1);
    } else {
      // Paste scenario — fill sequentially
      setDigits((d) => {
        const copy = [...d];
        for (let k = 0; k < clean.length && i + k < OTP_LENGTH; k++) {
          copy[i + k] = clean[k]!;
        }
        return copy;
      });
      setFocused(Math.min(i + clean.length, OTP_LENGTH - 1));
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setDigits((d) => {
        const copy = [...d];
        if (copy[i]) {
          copy[i] = "";
          return copy;
        }
        if (i > 0) {
          copy[i - 1] = "";
          setFocused(i - 1);
        }
        return copy;
      });
    } else if (e.key === "ArrowLeft" && i > 0) {
      setFocused(i - 1);
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      setFocused(i + 1);
    } else if (e.key === "Enter") {
      void verify();
    }
  }

  async function verify() {
    setErr(null);
    setInfo(null);

    if (code.length !== OTP_LENGTH) {
      setErr("Please enter the 6-digit code.");
      return;
    }

    setVerifying(true);
    try {
      const r = await fetch("/api/admin/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(data?.error ?? "Invalid or expired code.");
        return;
      }
      sessionStorage.removeItem("mfa_sent");
      router.replace(next);
    } catch {
      setErr("Network error while verifying.");
    } finally {
      setVerifying(false);
    }
  }

  const canResend = !sending && (cooldownSec <= 0);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-sm rounded-2xl p-6 md:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Admin verification</h1>
          <p className="text-sm text-gray-600 mt-2">
            Enter the 6-digit code we sent to your email.
          </p>

          {/* Info / Error banners */}
          {info && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {info}
            </div>
          )}
          {err && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          {/* OTP Inputs */}
          <div className="mt-6 flex justify-between gap-2">
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <input
                key={i}
                ref={(el) => (inputsRef.current[i] = el)}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1}`}
                className="h-12 w-12 rounded-xl border border-gray-200 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-black/5"
                value={digits[i]}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={() => setFocused(i)}
                maxLength={1}
              />
            ))}
          </div>

          {/* Expiry + Resend controls */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div>
              {expiresAt && (
                <span>
                  Expires in{" "}
                  <span className="font-medium text-gray-900">
                    {formatSeconds(expiresInSec)}
                  </span>
                </span>
              )}
            </div>
            <button
              className={`rounded-lg border px-3 py-1.5 transition ${
                canResend
                  ? "border-gray-300 hover:bg-gray-50"
                  : "border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
              onClick={() => send(/* force */ false)}
              disabled={!canResend}
              title={
                canResend
                  ? "Resend code"
                  : cooldownSec > 0
                  ? `Please wait ${formatSeconds(cooldownSec)}`
                  : "Sending…"
              }
            >
              {cooldownSec > 0 ? `Resend in ${formatSeconds(cooldownSec)}` : sentOnce ? "Resend" : "Send code"}
            </button>
          </div>

          {/* Force resend (optional: visible only if email failed) */}
          {/* <button onClick={() => send(true)} className="mt-2 text-xs text-gray-500 underline">Force resend</button> */}

          {/* Verify button */}
          <button
            onClick={verify}
            disabled={verifying || code.length !== OTP_LENGTH}
            className={`mt-6 w-full rounded-xl px-4 py-2.5 font-medium transition ${
              verifying || code.length !== OTP_LENGTH
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-black"
            }`}
          >
            {verifying ? "Verifying…" : "Verify"}
          </button>

          {/* Help text */}
          <p className="mt-4 text-xs text-gray-500">
            Didn’t get the email? Check your spam folder or click “Resend”.
          </p>
        </div>

        {/* Small footer */}
        <p className="text-center mt-4 text-xs text-gray-400">
          For your security, codes expire quickly.
        </p>
      </div>
    </main>
  );
}

/* ---------- helpers ---------- */
function useCountdown(target: Date | null) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!target) {
      setSec(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((target.getTime() - Date.now()) / 1000));
      setSec(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return sec;
}

function formatSeconds(s: number) {
  if (s <= 0) return "0s";
  const m = Math.floor(s / 60);
  const ss = s % 60;
  if (m <= 0) return `${ss}s`;
  return `${m}m ${ss.toString().padStart(2, "0")}s`;
}
