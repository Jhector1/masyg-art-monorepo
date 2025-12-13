// app/api/admin/printful/sync/route.ts
import { NextResponse } from "next/server";
import { syncPrintfulProducts } from "@acme/core/integrations/printful-sync";

export async function POST() {
  const count = await syncPrintfulProducts();
  return NextResponse.json({ synced: count });
}
