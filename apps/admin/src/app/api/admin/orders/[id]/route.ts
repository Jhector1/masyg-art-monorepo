import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/services/admin/orders";
import { requireAdmin } from "@/lib/require-admin";
type Params = { params:Promise< { id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
     await requireAdmin(_req);
       const { id } = await params; // ✅

    const row = await getOrder(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: Params) {
         await requireAdmin(req);
  const { id } = await params; // ✅

    const body = await req.json(); // { status: "PAID" | ... }
  const updated = await updateOrderStatus(id, body);
  return NextResponse.json(updated);
}
