import { NextRequest, NextResponse } from "next/server";
import { listUsers } from "@/services/admin/users";
import {auth} from '@/lib/auth'

export async function GET(req: NextRequest) {
     const session = await auth();
        if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  const data = await listUsers({ q, page, pageSize });
  return NextResponse.json(data);
}
