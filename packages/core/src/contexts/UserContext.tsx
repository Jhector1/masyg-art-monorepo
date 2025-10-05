"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  startTransition,
} from "react";
import {
  SessionProvider,
  useSession,
  signIn,
  signOut,
  getSession,
} from "next-auth/react";
import { useRouter } from "next/navigation";
import { getOrCreateGuestId } from "../utils/client-only/getOrCreateGuestId";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
  updatedAt?: string;
  image?: string;
};

type LoginCredsArgs = { email: string; password: string; callbackUrl?: string };
type LoginProviderArgs = { provider: string; callbackUrl?: string };
type AuthAction = "login" | "provider-login" | "logout" | "idle";

export type UserContextType = {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  guestId: string | null;
  isAuthBusy: boolean;
  authAction: AuthAction;
  sessionPulse: number;
  login: () => void;
  loginWithCredentials: (args: LoginCredsArgs) =>
    Promise<{ ok: true } | { ok: false; error: string }>;
  loginWithProvider: (args: LoginProviderArgs) => void;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  isLoggedIn: false,
  guestId: null,
  isAuthBusy: false,
  authAction: "idle",
  sessionPulse: 0,
  login: () => {},
  loginWithCredentials: async () => ({ ok: false, error: "not implemented" }),
  loginWithProvider: () => {},
  logout: async () => {},
});

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <UserContextInner>{children}</UserContextInner>
    </SessionProvider>
  );
}

function UserContextInner({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [optimisticLogin, setOptimisticLogin] = useState<boolean | null>(null);
  const [optimisticUser, setOptimisticUser] = useState<User | null>(null);

  const loading = status === "loading";
  const isLoggedIn = (optimisticLogin ?? !!session?.user);
  const user = (optimisticUser ?? (session?.user as User)) ?? null;

  const guestId = !isLoggedIn ? getOrCreateGuestId() : null;

  const [isAuthBusy, setAuthBusy] = useState(false);
  const [authAction, setAuthAction] = useState<AuthAction>("idle");
  const [sessionPulse, setSessionPulse] = useState(0);

  // Clear optimism ONLY when NextAuth settles in the intended state
  useEffect(() => {
    if (optimisticLogin === true && status === "authenticated") {
      setOptimisticLogin(null);
      setOptimisticUser(null);
    }
    if (optimisticLogin === false && status === "unauthenticated") {
      setOptimisticLogin(null);
      setOptimisticUser(null);
    }
  }, [status, optimisticLogin]);

  const runAuth = async <T,>(action: AuthAction, fn: () => Promise<T>) => {
    if (isAuthBusy) return fn();
    setAuthAction(action);
    setAuthBusy(true);
    try {
      return await fn();
    } finally {
      setAuthBusy(false);
      setAuthAction("idle");
    }
  };

  const login = () => {
    const cb =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    signIn(undefined, { callbackUrl: cb });
  };
// in UserContextInner > loginWithCredentials
const loginWithCredentials: UserContextType["loginWithCredentials"] = async ({
  email,
  password,
  callbackUrl = "/profile",
}) =>
  runAuth("login", async () => {
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    if (!result) return { ok: false, error: "Login failed" };
    if (result.error) return { ok: false, error: result.error };

    setOptimisticLogin(true);
    setOptimisticUser({ id: "optimistic", email, name: email.split("@")[0] });
    setSessionPulse((n) => n + 1);

    await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
    await update();
    await getSession();
    setSessionPulse((n) => n + 1);

    // 🔒 Normalize to internal path
    const toInternal = (u: string) => {
      try {
        if (u.startsWith("/")) return u;                       // already relative
        const parsed = new URL(u);
        if (parsed.origin === window.location.origin) {
          return parsed.pathname + parsed.search + parsed.hash; // same-origin absolute -> make relative
        }
      } catch {}
      // fallback to provided callbackUrl or home
      return callbackUrl.startsWith("/") ? callbackUrl : "/";
    };

    const dest = toInternal(result.url ?? callbackUrl);

    // Use client router once it's definitely internal
    startTransition(() => {
      router.replace(dest);
      router.refresh();
    });

    return { ok: true };
  });


  // Also pulse whenever derived state flips
  useEffect(() => {
    setSessionPulse((n) => n + 1);
  }, [isLoggedIn]);

  const loginWithProvider: UserContextType["loginWithProvider"] = ({
    provider,
    callbackUrl = "/profile",
  }) => {
    runAuth("provider-login", async () => {
      setOptimisticLogin(true);
      setSessionPulse((n) => n + 1);
      signIn(provider, { callbackUrl }); // redirect
      return;
    });
  };

  const logout = async () =>
    runAuth("logout", async () => {
      setOptimisticLogin(false);
      setOptimisticUser(null);
      setSessionPulse((n) => n + 1);
      document.cookie = "guest_id=; max-age=0; path=/; SameSite=Lax";
      document.cookie = "next-auth.callback-url=; max-age=0; path=/";
      document.cookie = "__Secure-next-auth.callback-url=; max-age=0; path=/";
      try {
        await fetch("/api/auth/clear", { method: "POST" });
      } catch {}
      await signOut({ redirect: true, callbackUrl: "/" });
    });

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        isLoggedIn,
        guestId,
        isAuthBusy,
        authAction,
        sessionPulse,
        login,
        loginWithCredentials,
        loginWithProvider,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
