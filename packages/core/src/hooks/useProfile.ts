// hooks/useProfile.ts  (client)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ProfileResponse,
  ProfileOk,
  ProfileError,
  UserProfile,
} from "@acme/ui/components/profile/types";

type UseProfileOptions = {
  disabled?: boolean;
  refreshIntervalMs?: number;
  onUnauthorized?: () => void;
};

type UseProfileResult = {
  user: UserProfile | null;
  loading: boolean;
  error: ProfileError | null;
  refresh: () => Promise<void>;
  unauthorized: boolean;
  mutate: (updater: (u: UserProfile | null) => UserProfile | null) => void;
};

const PROFILE_ENDPOINT = "/api/auth/profile";

export function useProfile(options: UseProfileOptions = {}): UseProfileResult {
  const { disabled = false, refreshIntervalMs, onUnauthorized } = options;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<ProfileError | null>(null);
  const [loading, setLoading] = useState<boolean>(!disabled);
  const [unauthorized, setUnauthorized] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const retried401Ref = useRef(false);

  const onUnauthorizedRef = useRef<UseProfileOptions["onUnauthorized"]>(onUnauthorized);
  useEffect(() => { onUnauthorizedRef.current = onUnauthorized; }, [onUnauthorized]);

  const abortInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    abortInFlight();
    stopTimer();
  }, [abortInFlight, stopTimer]);

  const fetchOnce = useCallback(async () => {
    if (disabled) return;

    abortInFlight();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    try {
      const url = `${PROFILE_ENDPOINT}${PROFILE_ENDPOINT.includes("?") ? "&" : "?"}ts=${Date.now()}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        credentials: "include",
        signal: ac.signal,
      });

      if (res.status === 401) {
        if (!retried401Ref.current) {
          retried401Ref.current = true;
          await new Promise(r => setTimeout(r, 350));
          return fetchOnce();
        }
        retried401Ref.current = false;
        // setUnauthorized(true);
        // setUser(null);
        setError({ error: "Unauthorized" });
        onUnauthorizedRef.current?.();
        return;
      }

      retried401Ref.current = false;

      const json = (await res.json()) as ProfileResponse;
      if (!res.ok) {
        setUser(null);
        setError((json as ProfileError) ?? { error: "Request failed" });
        return;
      }

      const ok = json as ProfileOk;
      setUser(ok.user);
      setUnauthorized(false);
      setError(null);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setUser(null);
      setError({ error: e?.message ?? "Network error" });
    } finally {
      setLoading(false);
    }
  }, [disabled, abortInFlight]);

  const refresh = useCallback(async () => { await fetchOnce(); }, [fetchOnce]);

  const mutate = useCallback((updater: (u: UserProfile | null) => UserProfile | null) => {
    setUser(prev => updater(prev));
  }, []);

  useEffect(() => {
    if (!disabled) fetchOnce();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(() => {
    if (disabled || !refreshIntervalMs) return;
    stopTimer();
    timerRef.current = window.setInterval(() => { fetchOnce(); }, refreshIntervalMs) as unknown as number;
    return stopTimer;
  }, [disabled, refreshIntervalMs, fetchOnce, stopTimer]);

  return { user, loading, error, refresh, unauthorized, mutate };
}
