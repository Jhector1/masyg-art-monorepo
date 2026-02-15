import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Returns { userId } if authenticated, otherwise { guestId } if guest cookie exists.
 * IMPORTANT: relies on cookie name "guest_id" consistently.
 */
export async function getCustomerIdFromRequest(
  req: NextRequest
): Promise<{ userId?: string; guestId?: string }> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // token.sub is usually the user id
  const userId =
    (token?.sub as string | undefined) ||
    ((token as any)?.id as string | undefined);

  if (userId) return { userId };

  const guestId = req.cookies.get("guest_id")?.value;
  if (guestId) return { guestId };

  return {};
}
