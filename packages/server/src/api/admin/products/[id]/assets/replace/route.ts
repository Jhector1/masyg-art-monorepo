import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
import { cloudinary } from "@acme/core/lib/cloudinary";
import crypto from "crypto";
import {
  rootFromPublicId,
  subfolders,
  safeCategory as toSafeCategory,
  currentEnv,
} from "@acme/core/lib/productFolders";
import {
  upsertProductAsset,
  extFromUrl,
  mimeFromExt,
  isVectorExt,
} from "@acme/core/lib/productAssets";
import type {  UploadApiResponse } from "cloudinary";
import { deleteByPrefix, getFiles, getStr, isNonEmptyFile, uploadFile } from "packages/server/src/utils";


export async function replaceProductAssets(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const {id}= await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true, assets: true },
    });
    if (!product)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const form = await req.formData();

    // Optional metadata updates (can be used even without files)
    const maybeTitle = getStr(form, "title");
    const maybeDesc = getStr(form, "description");
    const maybePrice = getStr(form, "price");
    const maybeCategory = getStr(form, "category");
    const newSizes = form.getAll("sizes").map(String).filter(Boolean);

    // Files
    const mainFile = form.get("main");
    const svgFile = form.get("svg");
    const thumbs = getFiles(form, "thumbnails");
    const formats = getFiles(form, "formats");

    // What are we actually replacing?
    const replacingMain = isNonEmptyFile(mainFile);
    const replacingSvg = isNonEmptyFile(svgFile);
    const replacingThumbs = thumbs.length > 0;
    const replacingFormats = formats.length > 0;

    const env = currentEnv();
    let safeCat = product.category
      ? toSafeCategory(product.category.name)
      : "uncategorized";
    if (maybeCategory) safeCat = toSafeCategory(maybeCategory);

    // Compute root from existing publicId or generate a stable one
    let root = rootFromPublicId(product.publicId);
    if (!root) {
      const myUUID = `${(maybeTitle || product.title) || "product"}-${crypto.randomUUID()}`;
      root = `products-${env}/${safeCat}/${myUUID}`;
    }
    const folders = subfolders(root);

    // ---- TARGETED DELETION (only for parts being replaced) ----
    if (replacingMain) {
      await deleteByPrefix(folders.main, "image");
      if (product.publicId) {
        try {
          await cloudinary.api.delete_resources([product.publicId], {
            resource_type: "image",
            invalidate: true,
          });
        } catch {}
      }
    }
    if (replacingThumbs) await deleteByPrefix(folders.thumbnails, "image");
    if (replacingSvg) {
      await deleteByPrefix(folders.svg, "raw");
      await deleteByPrefix(folders.svgPreview, "raw");
    }
    if (replacingFormats) {
      await deleteByPrefix(folders.formats, "image");
      await deleteByPrefix(folders.formats, "raw");
    }

    // ---- UPLOADS ----
    let mainRes: UploadApiResponse | null = null;
    let svgRaw: UploadApiResponse | null = null;
    let svgPreview: UploadApiResponse | null = null;
    const thumbsRes: UploadApiResponse[] = [];
    const otherRes: UploadApiResponse[] = [];

    if (replacingMain) {
      const file = mainFile as File;
      mainRes = await uploadFile(file, {
        folder: folders.main,
        public_id: "original",
        resource_type: "image",
        transformation: [
          { quality: "auto", fetch_format: "auto" },
          {
            overlay: { public_id: "watermark" },
            width: "1.0",
            height: "1.0",
            crop: "fill",
            gravity: "center",
            opacity: 10,
            flags: ["relative"],
          },
        ],
      });
    }

    if (replacingThumbs) {
      for (const t of thumbs) {
        const up = await uploadFile(t, {
          folder: folders.thumbnails,
          use_filename: true,
          unique_filename: true,
          resource_type: "image",
          transformation: [{ fetch_format: "auto", quality: "auto" }],
        });
        thumbsRes.push(up);
      }
    }

    if (replacingSvg) {
      const file = svgFile as File;
      const base = file.name.replace(/\.[^/.]+$/, "");
      svgRaw = await uploadFile(file, {
        folder: folders.svg,
        use_filename: true,
        unique_filename: true,
        resource_type: "raw",
      });
      svgPreview = await uploadFile(file, {
        folder: folders.svgPreview,
        public_id: `${base}_preview`,
        use_filename: true,
        unique_filename: true,
        resource_type: "raw",
      });
    }

    if (replacingFormats) {
      for (const f of formats) {
        if (f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg")) continue;
        const isPdf =
          f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
        const up = await uploadFile(f, {
          folder: folders.formats,
          use_filename: true,
          unique_filename: true,
          resource_type: isPdf ? "raw" : "auto",
        });
        otherRes.push(up);
      }
    }

    // ---- BUILD NEW FIELD ARRAYS ----
    let thumbnails: string[] = product.thumbnails ?? [];
    const newMainUrl = replacingMain
      ? mainRes!.secure_url
      : product.thumbnails?.[0] ?? null;

    if (replacingThumbs) {
      thumbnails = [];
      if (newMainUrl) thumbnails.push(newMainUrl);
      thumbnails.push(...thumbsRes.map((r) => r.secure_url));
    } else if (replacingMain) {
      if (thumbnails.length) thumbnails = [newMainUrl!, ...thumbnails.slice(1)];
      else thumbnails = [newMainUrl!];
    }

    const formatsUrls = replacingFormats
      ? otherRes.map((r) => r.secure_url)
      : product.formats;

    const svgFormatUrl = replacingSvg
      ? svgRaw?.secure_url ?? null
      : product.svgFormat;
    const svgPreviewUrl = replacingSvg
      ? svgPreview?.secure_url ?? null
      : product.svgPreview;

    // ---- PERSIST ----
    const updated = await prisma.$transaction(async (tx) => {
      const data: any = {
        publicId:
          replacingMain && mainRes?.public_id
            ? mainRes.public_id
            : product.publicId,
        thumbnails,
        formats: formatsUrls,
        svgFormat: svgFormatUrl,
        svgPreview: svgPreviewUrl,
        sizes: newSizes.length ? newSizes : product.sizes,
      };

      // only set when provided
      if (maybeTitle !== undefined) data.title = maybeTitle;
      if (maybeDesc !== undefined) data.description = maybeDesc;
      if (maybePrice !== undefined) data.price = parseFloat(maybePrice);

      if (maybeCategory !== undefined) {
        const cat = await tx.category.upsert({
          where: { name: maybeCategory },
          create: { name: maybeCategory },
          update: {},
          select: { id: true },
        });
        data.category = { connect: { id: cat.id } };
      }

      const updatedProd = await tx.product.update({
        where: { id: product.id },
        data,
      });

   // ---- UPDATE ProductAsset rows only for what changed ----
if (replacingSvg) {
  // Delete only existing SVG assets
  await tx.productAsset.deleteMany({
    where: { productId: product.id, ext: "svg" },
  });

  const preview = updatedProd.thumbnails?.[0] || updatedProd.svgPreview || null;

  if (svgRaw) {
    await upsertProductAsset(tx, {
      productId: product.id,
      url: svgRaw.secure_url,
      storageKey: svgRaw.public_id,
      previewUrl: preview ?? undefined,
      ext: "svg",
      mimeType: "image/svg+xml",
      isVector: true,
      sizeBytes: svgRaw.bytes ?? undefined,
      resourceType: svgRaw.resource_type as "raw" | "image" | "video",
      deliveryType: (svgRaw as any).type as
        | "upload"
        | "authenticated"
        | "private",
    });
  }
}

if (replacingFormats) {
  // Delete only non-SVG formats
  await tx.productAsset.deleteMany({
    where: { productId: product.id, NOT: { ext: "svg" } },
  });

  const preview = updatedProd.thumbnails?.[0] || updatedProd.svgPreview || null;

  for (const up of otherRes) {
    const ext = (up.format || extFromUrl(up.secure_url)).toLowerCase();
    await upsertProductAsset(tx, {
      productId: product.id,
      url: up.secure_url,
      storageKey: up.public_id,
      previewUrl: preview ?? undefined,
      ext,
      mimeType: mimeFromExt(ext),
      isVector: isVectorExt(ext),
      sizeBytes: up.bytes ?? undefined,
      width: up.width ?? undefined,
      height: up.height ?? undefined,
      resourceType: up.resource_type as "raw" | "image" | "video",
      deliveryType: (up as any).type as
        | "upload"
        | "authenticated"
        | "private",
    });
  }
}


      return updatedProd;
    });

    return NextResponse.json({ ok: true, product: updated });
  } catch (err: any) {
    console.error("POST /api/admin/products/[id]/assets/replace error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
