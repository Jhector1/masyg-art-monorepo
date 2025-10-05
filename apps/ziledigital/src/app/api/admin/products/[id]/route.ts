import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@acme/core/lib/auth";
import { deleteProductDeep } from "@acme/core/lib/deleteProduct";
import { prisma } from "@acme/core/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ProductPatchSchema } from "@acme/core/lib/validators/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idFromReq(req: NextRequest): string {
  // /api/admin/products/[id] → last segment
  const id = req.nextUrl.pathname.split("/").pop();
  if (!id) throw new Error("Missing id in path");
  return decodeURIComponent(id);
}

export async function GET(req: NextRequest) {
  const id = idFromReq(req);
  const p = await prisma.product.findUnique({ where: { id } });
  return p
    ? NextResponse.json(p)
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest) {
  await requireAdmin(req);

  const body = await req.json().catch(() => ({}));
  const parsed = ProductPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const data: Prisma.ProductUpdateInput = {};

  if (d.title !== undefined) data.title = d.title;
  if (d.description !== undefined) data.description = d.description;
  if (d.price !== undefined) data.price = d.price;
  if (d.publicId !== undefined) data.publicId = d.publicId;

  if (d.sizes !== undefined) data.sizes = d.sizes;
  if (d.thumbnails !== undefined) data.thumbnails = d.thumbnails;
  if (d.formats !== undefined) data.formats = d.formats;

  if (d.svgFormat !== undefined) data.svgFormat = d.svgFormat;
  if (d.svgPreview !== undefined) data.svgPreview = d.svgPreview;

  if (d.salePercent !== undefined) data.salePercent = d.salePercent;
  if (d.salePrice !== undefined) data.salePrice = d.salePrice;
  if (d.saleStartsAt !== undefined)
    data.saleStartsAt = d.saleStartsAt ? new Date(d.saleStartsAt) : null;
  if (d.saleEndsAt !== undefined)
    data.saleEndsAt = d.saleEndsAt ? new Date(d.saleEndsAt) : null;

  // relation update (don’t set categoryId directly on ProductUpdateInput)
// …inside PATCH
if (d.categoryId !== undefined) {
  const cid = d.categoryId?.trim();
  if (!cid) {
    // either:
    return NextResponse.json(
      { error: "categoryId is required for this product (relation is required)" },
      { status: 400 }
    );
    // or just skip updating category:
    // (do nothing)
  } else {
    data.category = { connect: { id: cid } };
  }
}

  const id = idFromReq(req);

  const updated = await prisma.product.update({
    where: { id },
    data,
    include: { category: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  await requireAdmin(req);
  const hard = req.nextUrl.searchParams.get("hard") === "1";

  const id = idFromReq(req);

  const exists = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const out = await deleteProductDeep(id, { hard });
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Delete failed" },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return NextResponse.json(null, { status: 204 });
}
