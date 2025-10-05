import type { NextRequest } from "next/server";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

/** Wrap the shared helper so services can be used outside routes if needed. */
export async function resolveIdentity(req?: NextRequest) {
  if (!req) return { userId: undefined as string | undefined, guestId: undefined as string | undefined };
  const { userId, guestId } = await getCustomerIdFromRequest(req);
  return { userId: userId ?? undefined, guestId: guestId ?? undefined };
}
