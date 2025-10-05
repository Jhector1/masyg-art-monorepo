// src/app/auth/profile/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { prisma } from "@acme/core/lib/prisma";
import { cloudinary } from "@acme/core/lib/cloudinary";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";

type JsonPayload = {
  name?: string;
  email?: string;
  password?: string; // required if name or email is being changed
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIM = 1024;

/**
 * Attempt to derive a Cloudinary public_id from a known secure_url.
 * Example:
 *  https://res.cloudinary.com/<cloud>/image/upload/v1720000000/users-dev/profile/<uid>/avatar.webp
 *  -> users-dev/profile/<uid>/avatar
 */
function extractPublicIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const afterUpload = u.pathname.split("/upload/")[1] ?? "";
    const parts = afterUpload.split("/").filter(Boolean);
    if (parts[0]?.match(/^v\d+$/)) parts.shift(); // remove version segment if present
    const file = parts.pop() ?? "";
    const noExt = file.replace(/\.[^.]+$/, "");
    return [...parts, noExt].join("/");
  } catch {
    return null;
  }
}

async function uploadAvatar(opts: {
  userId: string;
  file: File;
  existingPublicId?: string | null;
}) {
  const { userId, file, existingPublicId } = opts;

  if (!file || !(file instanceof File)) throw new Error("No file provided.");
  if (!file.type?.startsWith("image/")) throw new Error("Invalid file type.");

  // Get a Node Buffer from the web File without explicit Buffer typing
  const ab = await file.arrayBuffer();
  let buffer = Buffer.from(ab);

  // Auto-shrink if needed (keep aspect ratio, respect EXIF)
  if (buffer.length > MAX_BYTES) {
    for (const quality of [80, 70, 60, 50]) {
      try {
        const out = await sharp(buffer)
          .rotate()
          .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
          .webp({ quality, effort: 4 });
        // .toBuffer() can take a Buffer directly; normalize to Buffer again
        buffer = Buffer.from(await out.toBuffer());
        if (buffer.length <= MAX_BYTES) break;
      } catch (err) {
        if (buffer.length <= MAX_BYTES) break;
        throw err;
      }
    }
    if (buffer.length > MAX_BYTES) {
      throw new Error("File too large (max 5MB).");
    }
  }

  // Use a stable public_id so the same asset is overwritten on update
  const stablePublicId =
    existingPublicId ||
    `users-${process.env.NODE_ENV}/profile/${userId}/avatar`;

  const result = await new Promise<import("cloudinary").UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: stablePublicId,    // <— stable id
        overwrite: true,              // <— replace existing asset
        invalidate: true,             // <— purge cached versions
        resource_type: "image",
        format: "webp",
        unique_filename: false,
        use_filename: false,
        type: "upload",
      },
      (err, res) => (err ? reject(err) : resolve(res!))
    );
    stream.end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await getCustomerIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        avatarUrl: true,
        avatarPublicId: true, // <— add this column in your Prisma model
        updatedAt: true,
      },
    });

    if (!me) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    // -------- multipart: avatar upload (replace existing) --------
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("avatar");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided as 'avatar'." }, { status: 400 });
      }

      const existingPublicId = me.avatarPublicId ?? extractPublicIdFromUrl(me.avatarUrl);
      const { url, publicId } = await uploadAvatar({ userId: me.id, file, existingPublicId });

      const updated = await prisma.user.update({
        where: { id: me.id },
        data: {
          avatarUrl: url,
          avatarPublicId: publicId, // store for guaranteed overwrite next time
        },
        select: { id: true, name: true, email: true, avatarUrl: true, updatedAt: true },
      });

      return NextResponse.json({ user: updated }, { status: 200 });
    }

    // -------- JSON: name/email (password required) --------
    const body = (await req.json()) as JsonPayload;
    const wantName = typeof body.name === "string" && body.name.trim() !== "";
    const wantEmail = typeof body.email === "string" && body.email.trim() !== "";
    const wantsIdentityChange = wantName || wantEmail;

    if (!wantsIdentityChange) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    if (!body.password || !me.password) {
      return NextResponse.json({ error: "Password required to update profile." }, { status: 400 });
    }

    const ok = await bcrypt.compare(body.password, me.password);
    if (!ok) {
      return NextResponse.json({ error: "Invalid password." }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id: me.id },
      data: {
        name: wantName ? body.name!.trim() : undefined,
        email: wantEmail ? body.email!.trim() : undefined,
      },
      select: { id: true, name: true, email: true, avatarUrl: true, updatedAt: true },
    });

    return NextResponse.json({ user: updated }, { status: 200 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Email is already in use." }, { status: 409 });
    }
    console.error("PATCH /auth/profile error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getCustomerIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pull user + light related info
    const [user, entAgg] = await Promise.all([
      prisma.user.findUnique({
        where: { id: String(userId) },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          image: true,
          createdAt: true,
          updatedAt: true,
          downloadCount: true,
          _count: {
            select: {
              favorites: true,
              orders: true,
              reviews: true,
              designs: true,
              purchasedDesigns: true,
            },
          },
          cart: {
            select: {
              id: true,
              _count: { select: { items: true } },
            },
          },
          orders: {
            select: { id: true, status: true, total: true, placedAt: true },
            orderBy: { placedAt: "desc" },
            take: 1,
          },
          addresses: {
            select: {
              id: true,
              label: true,
              city: true,
              state: true,
              country: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.designEntitlement.aggregate({
        where: { userId: String(userId) },
        _sum: {
          exportQuota: true,
          editQuota: true,
          exportsUsed: true,
          editsUsed: true,
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sums = entAgg._sum || {};
    const exportQuota = sums.exportQuota ?? 0;
    const editQuota = sums.editQuota ?? 0;
    const exportsUsed = sums.exportsUsed ?? 0;
    const editsUsed = sums.editsUsed ?? 0;
    const lastOrder = user.orders?.[0] ?? null;

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      downloadCount: user.downloadCount,
      counts: {
        favorites: user._count.favorites,
        orders: user._count.orders,
        reviews: user._count.reviews,
        designs: user._count.designs,
        purchasedDesigns: user._count.purchasedDesigns,
        cartItems: user.cart?._count.items ?? 0,
      },
      lastOrder,
      addresses: user.addresses,
      entitlements: {
        exportQuota,
        editQuota,
        exportsUsed,
        editsUsed,
        exportRemaining: Math.max(0, exportQuota - exportsUsed),
        editRemaining: Math.max(0, editQuota - editsUsed),
      },
    };

    return NextResponse.json(
      { user: payload },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      }
    );
  } catch (e) {
    console.error("GET /api/auth/profile error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
