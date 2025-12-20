import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const VT = ["DIGITAL", "PRINT", "ORIGINAL"] as const;
const STATUS = ["ACTIVE", "RESERVED", "SOLD"] as const;
const FP = ["INTERNAL", "PRINTFUL"] as const;

type VariantType = (typeof VT)[number];
type InventoryStatus = (typeof STATUS)[number];
type FulfillmentProvider = (typeof FP)[number];

function isOneOf<T extends readonly string[]>(arr: T, v: any): v is T[number] {
  return typeof v === "string" && (arr as readonly string[]).includes(v);
}

function toNumOrNull(v: any) {
  if (v === null) return null;
  if (v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toIntOrNull(v: any) {
  const n = toNumOrNull(v);
  if (n === undefined) return undefined;
  if (n === null) return null;
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function toBoolOrNull(v: any) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "") return null; // treat empty as "inherit"/null
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return undefined;
}

function toStrOrNull(v: any) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : null;
  }
  return undefined;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: productId, variantId } = await params;

  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, productId: true },
  });

  if (!existing || existing.productId !== productId) {
    return NextResponse.json({ ok: false, error: "Variant not found" }, { status: 404 });
  }

  let input: any = {};
  try {
    input = await req.json();
  } catch {
    input = {};
  }

  const data: any = {};

  // --- enums ---
  if ("type" in input && isOneOf(VT, input.type)) data.type = input.type as VariantType;
  if ("status" in input && isOneOf(STATUS, input.status)) data.status = input.status as InventoryStatus;
  if ("fulfillmentProvider" in input && isOneOf(FP, input.fulfillmentProvider)) {
    data.fulfillmentProvider = input.fulfillmentProvider as FulfillmentProvider;
  }

  // --- numbers ---
  if ("inventory" in input) {
    const n = toIntOrNull(input.inventory);
    if (n !== undefined) data.inventory = n;
  }
  if ("listPrice" in input) {
    const n = toNumOrNull(input.listPrice);
    if (n !== undefined) data.listPrice = n;
  }
  if ("baseCost" in input) {
    const n = toNumOrNull(input.baseCost);
    if (n !== undefined) data.baseCost = n;
  }
  if ("widthIn" in input) {
    const n = toNumOrNull(input.widthIn);
    if (n !== undefined) data.widthIn = n;
  }
  if ("heightIn" in input) {
    const n = toNumOrNull(input.heightIn);
    if (n !== undefined) data.heightIn = n;
  }
  if ("depthIn" in input) {
    const n = toNumOrNull(input.depthIn);
    if (n !== undefined) data.depthIn = n;
  }
  if ("weightLb" in input) {
    const n = toNumOrNull(input.weightLb);
    if (n !== undefined) data.weightLb = n;
  }
  if ("year" in input) {
    const n = toIntOrNull(input.year);
    if (n !== undefined) data.year = n;
  }
  if ("packQuantity" in input) {
    const n = toIntOrNull(input.packQuantity);
    if (n !== undefined) data.packQuantity = n;
  }
  if ("printfulVariantId" in input) {
    const n = toIntOrNull(input.printfulVariantId);
    if (n !== undefined) data.printfulVariantId = n;
  }

  // --- booleans ---
  if ("framed" in input) {
    const b = toBoolOrNull(input.framed);
    if (b !== undefined) data.framed = b;
  }
  if ("requiresShipping" in input) {
    const b = toBoolOrNull(input.requiresShipping);
    if (b !== undefined) data.requiresShipping = b; // null = inherit Product.requiresShipping
  }

  // --- strings ---
  const STR_KEYS = [
    "format",
    "size",
    "material",
    "frame",
    "license",
    "medium",
    "surface",
    "originalSerial",
    "sku",
    "barcode",
    "upc",
    "hsCode",
  ] as const;

  for (const k of STR_KEYS) {
    if (k in input) {
      const s = toStrOrNull(input[k]);
      if (s !== undefined) data[k] = s;
    }
  }

  // --- attributes JSON ---
  if ("attributes" in input) {
    if (input.attributes === null) data.attributes = null;
    else if (typeof input.attributes === "object") data.attributes = input.attributes;
    else if (typeof input.attributes === "string") {
      const s = input.attributes.trim();
      data.attributes = s ? JSON.parse(s) : null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, variant: null, message: "No changes" });
  }

  try {
    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data,
    });
    return NextResponse.json({ ok: true, variant: updated });
  } catch (err: any) {
    // Prisma unique constraint
    if (err?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: `Duplicate value for unique field (${(err?.meta?.target ?? []).join(", ")})` },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: err?.message || "Update failed" }, { status: 500 });
  }
}
