// src/app/api/products/[id]/saveUserDesign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { requireUser } from "@acme/core/utils/requireUser";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
import { getEntitlementSummary } from "@acme/core/helpers/stripe/webhook/entitlements";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cloudinary config (safe no-op if envs missing)
const HAS_CLOUDINARY =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (HAS_CLOUDINARY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
}

type StylePayload = {
  fillColor: string;
  fillOpacity?: number;
  strokeColor: string;
  strokeOpacity?: number;
  strokeWidth: number;
  backgroundColor: string;
  backgroundOpacity?: number;
  defs?: Prisma.JsonValue | null;
};

type Body = {
  style: StylePayload; // REQUIRED (unchanged)
  previewDataUrl?: string; // data:image/...;base64,...
  width?: number; // default 800
  quality?: number; // default 70
};

// ---- helpers to mirror old fields via new tables ----
// async function getEntitlementSummary(
//   productId: string,
//   ids: { userId?: string | null; guestId?: string | null }
// ) {
//   const now = new Date();
//   const whereBase: any = {
//     productId,
//     OR: [] as any[],
//     OR_1: undefined,
//   };
//   if (ids.userId) whereBase.OR.push({ userId: ids.userId });
//   if (ids.guestId) whereBase.OR.push({ guestId: ids.guestId });
//   if (!whereBase.OR.length) return { exportQuota: 0, exportsUsed: 0, exportsLeft: 0 };

//   const ents = await prisma.designEntitlement.findMany({
//     where: {
//       productId,
//       OR: whereBase.OR,
//       OR_1: undefined,
//       // active only
//       OR_2: [{ expiresAt: null }, { expiresAt: { gt: now } }],
//     } as any,
//     select: { exportQuota: true, exportsUsed: true },
//   });

//   const exportQuota = ents.reduce((s, r) => s + (r.exportQuota || 0), 0);
//   const exportsUsed = ents.reduce((s, r) => s + (r.exportsUsed || 0), 0);
//   const exportsLeft = Math.max(0, exportQuota - exportsUsed);
//   return { exportQuota, exportsUsed, exportsLeft };
// }
// use this for any nullable JSON column write
const toJsonInput = (
  v: Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull =>
  v == null ? Prisma.JsonNull : (v as Prisma.InputJsonValue);
async function hasPurchased(
  productId: string,
  ids: { userId?: string | null; guestId?: string | null }
) {
  if (!ids.userId && !ids.guestId) return false;
  const row = await prisma.purchasedDesign.findFirst({
    where: {
      productId,
      OR: [
        ...(ids.userId ? [{ userId: ids.userId }] : []),
        ...(ids.guestId ? [{ guestId: ids.guestId }] : []),
      ],
    },
    select: { id: true },
  });
  return !!row;
}

// -------------------- POST: save design --------------------
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await ctx.params;

    // Accept signed-in or guest (keeps old behavior that allowed both in later version)
    let userId: string | null = null;
    let guestId: string | null = null;
    try {
      const u = await requireUser();
      userId = u.id;
    } catch {
      const ids = await getCustomerIdFromRequest(req);
      guestId = ids.guestId ?? null;
    }

    if (!userId && !guestId) {
      // old hook expects 401 with this message
      return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    const style = body?.style;
    if (!style)
      return NextResponse.json({ error: "Missing style" }, { status: 400 });
    const { defs: defsRaw, ...styleNoDefs } = (style as any) ?? {};

    // extract defs into its own column; keep shape identical to before
    // const defs = typeof style.defs === "string" ? style.defs : undefined;
    const defs: Prisma.JsonValue | null = defsRaw ?? null;

    // Upsert per-user/guest + product
    // ⬇️ use styleNoDefs + defs in the upsert
    const styleJson = JSON.parse(
      JSON.stringify(styleNoDefs)
    ) as Prisma.JsonValue;

    const design = await prisma.userDesign.upsert({
      where: userId
        ? { userId_productId: { userId, productId } }
        : { guestId_productId: { guestId: guestId!, productId } },
      update: { style: toJsonInput(styleJson), defs: toJsonInput(defs) },
      create: {
        userId: userId ?? undefined,
        guestId: guestId ?? undefined,
        productId,
        style: toJsonInput(styleJson),
        defs: toJsonInput(defs),
      },
      select: { id: true, previewUrl: true, updatedAt: true },
    });
    // Optional preview upload (unchanged contract)
    let previewUrl: string | null = design.previewUrl ?? null;
    let previewUpdatedAt: string | null = null;

    if (HAS_CLOUDINARY && body?.previewDataUrl?.startsWith("data:image/")) {
      try {
        const base64 = body.previewDataUrl.split(",")[1] || "";
        const input = Buffer.from(base64, "base64");

        const w = Math.max(64, Math.min(2000, Number(body.width) || 800));
        const q = Math.max(1, Math.min(100, Number(body.quality) || 70));

        const webp = await sharp(input)
          .resize({
            width: w,
            withoutEnlargement: true,
            fit: "inside",
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .webp({ quality: q })
          .toBuffer();
          const folder = `products-customize-${process.env.NEXT_ENV || "dev"}/designs/previews`;  // ✅ no trailing "design_"
        const publicId = `design_${design.id}`; 
        const uploaded = await new Promise<any>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder,
                public_id: publicId,
                resource_type: "image",
                type: "upload",
                overwrite: true,
                format: "webp",
                invalidate: true,
              },
              (err, res) => (err ? reject(err) : resolve(res))
            )
            .end(webp);
        });

        previewUrl = uploaded.secure_url as string;
        const updated = await prisma.userDesign.update({
          where: { id: design.id },
          data: {
            previewPublicId: uploaded.public_id,
            previewUrl,
            previewUpdatedAt: new Date(),
          },
          select: { previewUrl: true, previewUpdatedAt: true },
        });

        previewUrl = updated.previewUrl ?? previewUrl ?? null;
        await syncDesignToCartItems(prisma, {
          userId,
          guestId,
          productId,
          designId: design.id,
          previewUrl,
        });
        previewUpdatedAt = updated.previewUpdatedAt
          ? new Date(updated.previewUpdatedAt).toISOString()
          : null;
      } catch (e) {
        console.warn("Preview upload failed:", (e as Error).message);
      }
    }

    // ---- Map new data model → old response names
    const ent = await getEntitlementSummary({ userId, guestId }, productId);
    const purchased = await hasPurchased(productId, { userId, guestId });

    // same rule your status route used:
    const signedIn = !!userId;
    const canExport = signedIn && purchased && ent.exportsLeft > 0;

    return NextResponse.json({
      ok: true,
      // old simple response:
      canExport,
      exportsLeft: ent.exportsLeft,
      purchased,
      // newer extras (kept for compatibility):
      designId: design.id,
      previewUrl,
      previewUpdatedAt,
    });
  } catch (e: any) {
    if (e?.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    }
    console.error("SAVE_ERROR", e);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

// -------------------- GET: load saved design --------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const { userId, guestId } = await getCustomerIdFromRequest(req);

  // ⬇️ update the local type to match Prisma (defs is JSON now)
  function defsToString(v: Prisma.JsonValue | null): string | null {
    if (v == null) return null;
    return typeof v === "string" ? v : JSON.stringify(v);
  }
  let design: {
    id: string;
    style: Prisma.JsonValue;
    defs: Prisma.JsonValue | null;
    updatedAt: Date;
    previewUrl: string | null;
    previewUpdatedAt: Date | null;
  } | null = null;

  if (userId) {
    design = await prisma.userDesign.findUnique({
      where: { userId_productId: { userId, productId } },
      select: {
        id: true,
        style: true,
        defs: true,
        updatedAt: true,
        previewUrl: true,
        previewUpdatedAt: true,
      },
    });
  } else if (guestId) {
    design = await prisma.userDesign.findUnique({
      where: { guestId_productId: { guestId, productId } },
      select: {
        id: true,
        style: true,
        defs: true,
        updatedAt: true,
        previewUrl: true,
        previewUpdatedAt: true,
      },
    });
  }

  if (!design) return NextResponse.json({ found: false });

  // Provide old meta fields using new tables (aggregated)
  const ent = await getEntitlementSummary({ userId, guestId }, productId);
  const purchased = await hasPurchased(productId, { userId, guestId });

  return NextResponse.json({
    found: true,
    designId: design.id,
    style: design.style ?? {},
    defs: defsToString(design.defs) ?? "", // ← was "" before; keep that
    previewUrl: design.previewUrl ?? null,
    updatedAt: design.updatedAt,
    previewUpdatedAt: design.previewUpdatedAt ?? null,
    meta: {
      purchased,
      exportQuota: ent.exportQuota,
      exportsUsed: ent.exportsUsed,
      exportsLeft: ent.exportsLeft,
      updatedAt: design.updatedAt,
    },
  });
}

// Keeps cart lines for (user|guest, product) pointing at the canonical UserDesign
async function syncDesignToCartItems(
  db: typeof prisma,
  opts: {
    userId?: string | null;
    guestId?: string | null;
    productId: string;
    designId: string;
    style?: any;
    previewUrl?: string | null;
  }
) {
  const { userId, guestId, productId, designId, style, previewUrl } = opts;

  // locate the caller's cart
  const cart = await db.cart.findFirst({
    where: {
      OR: [...(userId ? [{ userId }] : []), ...(guestId ? [{ guestId }] : [])],
    },
    select: { id: true },
  });
  if (!cart) return;

  // 1) ensure every matching line references this design
  await db.cartItem.updateMany({
    where: {
      cartId: cart.id,
      productId,
      OR: [{ designId: null }, { designId: { not: designId } }],
    },
    data: {
      designId,
      // optional: keep a stable snapshot on the line
      styleSnapshot: style as any,
    },
  });

  // 2) (optional) if you just produced a preview, mirror it to lines
  if (previewUrl) {
    await db.cartItem.updateMany({
      where: { cartId: cart.id, productId },
      data: { previewUrlSnapshot: previewUrl },
    });
  }
}
// -------------------- DELETE: remove saved design --------------------
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await ctx.params;

    // Accept signed-in or guest (same auth pattern as POST)
    let userId: string | null = null;
    let guestId: string | null = null;
    try {
      const u = await requireUser();
      userId = u.id;
    } catch {
      const ids = await getCustomerIdFromRequest(req);
      guestId = ids.guestId ?? null;
    }

    if (!userId && !guestId) {
      return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    }

    // Find the design for this (user|guest, product)
    const design = await prisma.userDesign.findFirst({
      where: {
        productId,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(guestId ? [{ guestId }] : []),
        ],
      },
      select: { id: true, previewPublicId: true },
    });

    // Idempotent: nothing to delete -> ok:false? keep ok:true but deleted:false
    if (!design) {
      return NextResponse.json({ ok: true, deleted: false });
    }

    // Clear cart item references to avoid FK issues
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(guestId ? [{ guestId }] : []),
        ],
      },
      select: { id: true },
    });

    if (cart) {
    await prisma.cartItem.updateMany({
  where: {
    productId,
    designId: design.id,
    cart: { OR: [{ userId }, { guestId }] },
  },
  data: {
    designId: null,
    styleSnapshot: Prisma.JsonNull,
    previewUrlSnapshot: null,
  },
});

    }

    // Remove Cloudinary preview asset if stored
    if (HAS_CLOUDINARY && design.previewPublicId) {
      try {
        await new Promise((resolve, reject) => {
          cloudinary.uploader.destroy(
            design.previewPublicId!,
            { resource_type: "image", invalidate: true },
            (err, res) => (err ? reject(err) : resolve(res))
          );
        });
      } catch (e) {
        console.warn("Cloudinary destroy failed:", (e as Error).message);
      }
    }

    // Finally delete the design row
    await prisma.userDesign.delete({ where: { id: design.id } });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (e: any) {
    if (e?.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    }
    console.error("DELETE_DESIGN_ERROR", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
