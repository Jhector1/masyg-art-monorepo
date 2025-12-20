import { cookies } from "next/headers";
import crypto from "crypto";

const GUEST_COOKIE = "guest_id";

export function getOrCreateGuestId(): string {
  const store = cookies();
  let guestId = store.get(GUEST_COOKIE)?.value;

  if (!guestId) {
    guestId = crypto.randomUUID();

    store.set(GUEST_COOKIE, guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return guestId;
}

export function getGuestId(): string | null {
  return cookies().get(GUEST_COOKIE)?.value ?? null;
}

export function clearGuestId() {
  cookies().set(GUEST_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
}
