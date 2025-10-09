import { NextRequest, NextResponse } from "next/server";
import { listCategories, createCategory } from "@/services/admin/categories";
import { auth } from "@/lib/auth";

export async function GET() {
  const rows = await listCategories();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
     const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const created = await createCategory(body);
  return NextResponse.json(created, { status: 201 });
}
