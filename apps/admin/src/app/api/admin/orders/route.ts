import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/services/admin/orders";
import {auth} from '@/lib/auth'

export async function GET(req: NextRequest) {
       const session = await auth();
        if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  const data = await listOrders({ q, status, page, pageSize });
  return NextResponse.json(data);
}
