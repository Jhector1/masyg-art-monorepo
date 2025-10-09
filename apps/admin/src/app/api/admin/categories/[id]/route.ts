import { NextRequest, NextResponse } from "next/server";
import { updateCategory, deleteCategory } from "@/services/admin/categories";
import { auth } from "@/lib/auth";
type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
      const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updated = await updateCategory(params.id, body);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await deleteCategory(params.id);
  return NextResponse.json({ ok: true });
}
