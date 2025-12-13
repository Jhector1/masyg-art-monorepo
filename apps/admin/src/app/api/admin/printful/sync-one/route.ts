// apps/admin/app/api/admin/printful/sync-one/route.ts
import { NextRequest, NextResponse } from "next/server";
import { syncPrintfulProductById } from "@acme/core/integrations/printful-sync";

export async function POST(req: NextRequest) {
  const { syncProductId } = await req.json();

  if (!syncProductId) {
    return NextResponse.json(
      { error: "syncProductId is required" },
      { status: 400 }
    );
  }

  await syncPrintfulProductById(syncProductId);

  return NextResponse.json({ ok: true, syncProductId });
}
