'use client'
export function getOrCreateGuestId(): string | null {
  if (typeof document === "undefined") return null; // SSR-safe guard

  // const match = document.cookie.match(/guest_id=([^;]+)/);
  // if (match) return match[1];
 const match = document.cookie.match(/guest_id=([^;]+)/);
  return match ? match[1] : null;
  // const guestId = crypto.randomUUID();
  // document.cookie = `guest_id=${guestId}; path=/; max-age=${60 * 60 * 24 * 30}`;
  // return null;
}

