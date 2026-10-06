import { NextResponse } from "next/server";

/**
 * Legacy endpoint intentionally disabled.
 *
 * Customer login is exclusively handled by NextAuth (`/api/auth/*`). Keeping a
 * second JWT/cookie authentication system creates ambiguous principals and a
 * second secret/token lifecycle to secure.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "legacy_auth_disabled",
      message: "Use the NextAuth credentials or OAuth sign-in flow.",
    },
    { status: 410 },
  );
}
