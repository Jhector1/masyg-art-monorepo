import { getServerSession } from "next-auth";
import type { NextRequest } from "next/server";
import type { NextAuthOptions } from "next-auth";

export async function getPrincipalFromRequest(
  req: NextRequest,
  authOptions: NextAuthOptions
): Promise<{ userId?: string; guestId?: string }> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (userId) return { userId };

  const guestId = req.cookies.get("guest_id")?.value;
  return guestId ? { guestId } : {};
}
