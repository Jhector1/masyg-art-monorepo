import { cookies } from "next/headers";
import crypto from "crypto";

const GUEST_COOKIE = "guest_id";

export async function getOrCreateGuestId(): Promise<string> {
  const store = await cookies();
  let guestId = store.get(GUEST_COOKIE)?.value;

  if (!guestId) {
    guestId = crypto.randomUUID();

    store.set(GUEST_COOKIE, guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return guestId;
}

export async function getGuestId(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value ?? null;
}

export async function clearGuestId(): Promise<void> {
  const store = await cookies();
  store.set(GUEST_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
}
