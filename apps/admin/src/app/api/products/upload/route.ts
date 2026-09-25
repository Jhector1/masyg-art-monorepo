import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleAuthorizedAdminProductUpload } from "@acme/server/api/admin/products/upload/authorized-handler";

export const runtime = "nodejs";
export const config = { api: { bodyParser: false } };

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return handleAuthorizedAdminProductUpload(request);
}
