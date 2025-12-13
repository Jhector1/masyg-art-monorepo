// src/app/api/products/upload/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, ProductKind, VariantType } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import slugify from "slugify";
import crypto from "crypto";
import {
  upsertProductAsset,
  extFromUrl,
  mimeFromExt,
  isVectorExt,
} from "@acme/core/lib/productAssets";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const config = { api: { bodyParser: false } };

const db = new PrismaClient();
const env = process.env.NEXT_ENV ?? process.env.NODE_ENV ?? "dev";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

async function fileToDataUri(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buf.toString("base64")}`;
}

function requiresShippingByKind(kind: ProductKind): boolean {
  switch (kind) {
    case "STICKER":
    case "MUG":
    case "CARD":
      return true;
    case "BOOK_DIGITAL":
      return false;
    case "ART":
    case "OTHER":
    default:
      return false;
  }
}

async function createVariantsForKind(args: {
  tx: PrismaClient;
  productId: string;
  kind: ProductKind;
  variantType: VariantType;
  sizes: string[];
  kindAttributes?: Record<string, any>;
  originalMeta?: {
    widthIn?: number | null;
    heightIn?: number | null;
    depthIn?: number | null;
    weightLb?: number | null;
    year?: number | null;
    medium?: string | null;
    surface?: string | null;
    framed?: boolean;
    sku?: string | null;
  };
}) {
  const { tx, productId, kind, variantType, sizes, kindAttributes, originalMeta } = args;

  if (variantType === "ORIGINAL") {
    const {
      widthIn = null,
      heightIn = null,
      depthIn = null,
      weightLb = null,
      year = null,
      medium = null,
      surface = null,
      framed = false,
      sku = null,
    } = originalMeta || {};
    await tx.productVariant.create({
      data: {
        productId,
        type: "ORIGINAL",
        sku,
        inventory: 1,
        status: "ACTIVE",
        widthIn,
        heightIn,
        depthIn,
        weightLb,
        year,
        medium,
        surface,
        framed,
      },
    });
    return;
  }

  // Non-original kinds
  if (kind === "STICKER") {
    for (const size of sizes.map((s) => s.trim()).filter(Boolean)) {
      await tx.productVariant.create({
        data: {
          productId,
          type: "PRINT",
          size,
          material: kindAttributes?.material ?? "Matte Vinyl",
          attributes: {
            finish: kindAttributes?.finish ?? "Matte",
            cutType: kindAttributes?.cutType ?? "Die-cut",
            packQuantity: kindAttributes?.packQuantity ?? 1,
          },
          status: "ACTIVE",
          inventory: 999,
        },
      });
    }
    return;
  }

  if (kind === "MUG") {
    const selected = (kindAttributes?.selectedSizes as string[] | undefined) ?? sizes;
    const mugColor = kindAttributes?.mugColor ?? "White";
    const dishwasherSafe = !!kindAttributes?.dishwasherSafe;
    const finalSizes = (selected?.length ? selected : ["11oz"]).map((s) => s.trim());
    for (const size of finalSizes) {
      await tx.productVariant.create({
        data: {
          productId,
          type: "PRINT",
          size,
          material: "Ceramic",
          attributes: { mugColor, dishwasherSafe },
          status: "ACTIVE",
          inventory: 999,
        },
      });
    }
    return;
  }

  if (kind === "CARD") {
    for (const size of sizes.map((s) => s.trim()).filter(Boolean)) {
      await tx.productVariant.create({
        data: {
          productId,
          type: "PRINT",
          size,
          material: kindAttributes?.stock ?? "310gsm",
          attributes: {
            finish: kindAttributes?.finish ?? "Smooth",
            packQuantity: kindAttributes?.packQuantity ?? 54,
          },
          status: "ACTIVE",
          inventory: 999,
        },
      });
    }
    return;
  }

  if (kind === "BOOK_DIGITAL") {
    await tx.productVariant.create({
      data: {
        productId,
        type: "DIGITAL",
        status: "ACTIVE",
        attributes: {
          isbn: kindAttributes?.isbn,
          pageCount: kindAttributes?.pageCount,
          language: kindAttributes?.language ?? "English",
        },
      },
    });
    return;
  }

  // ART / OTHER
  const normSizes = sizes.map((s) => s.trim()).filter(Boolean);
  if (normSizes.length === 0) {
    await tx.productVariant.create({
      data: { productId, type: variantType, status: "ACTIVE" },
    });
  } else {
    for (const size of normSizes) {
      await tx.productVariant.create({
        data: { productId, type: variantType, size, status: "ACTIVE" },
      });
    }
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();

    const kindRaw = (formData.get("kind")?.toString() || "ART").toUpperCase() as ProductKind;
    const kind: ProductKind = ["ART", "STICKER", "MUG", "CARD", "BOOK_DIGITAL", "OTHER"].includes(kindRaw)
      ? kindRaw
      : "ART";

    const variantType = (formData.get("variantType")?.toString() || "DIGITAL") as VariantType;

    const categoryName = formData.get("category")?.toString().trim();
    const title = formData.get("title")?.toString().trim() || "";
    const description = formData.get("description")?.toString().trim() || "";
    const price = parseFloat(formData.get("price")?.toString() || "0");

    const mainFile = formData.get("main");
    if (!categoryName || !mainFile || !(mainFile instanceof File)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const kindAttributesStr = formData.get("kindAttributes")?.toString();
    const kindAttributes = kindAttributesStr ? (JSON.parse(kindAttributesStr) as Record<string, any>) : undefined;

    const sizes =
      variantType !== "ORIGINAL"
        ? formData.getAll("sizes").map((s) => s.toString()).filter(Boolean)
        : [];

    const safeCategory = slugify(categoryName, { lower: true, strict: true });
    const myUUID = `${title}-${crypto.randomUUID()}`;

   // 1) MAIN upload — watermark only for DIGITAL or PRINT
const mainUri = await fileToDataUri(mainFile);
const shouldWatermark = variantType === "DIGITAL" || variantType === "PRINT";

const baseUploadOpts = {
  folder: `products-${env}/${safeCategory}/${myUUID}/main`,
  public_id: "original",
  resource_type: "image" as const,
};

const qAuto = [{ quality: "auto", fetch_format: "auto" }];

const mainRes = await cloudinary.uploader.upload(
  mainUri,
  shouldWatermark
    ? {
        ...baseUploadOpts,
        transformation: [
          ...qAuto,
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
      }
    : {
        ...baseUploadOpts,
        transformation: qAuto, // no watermark for ORIGINAL
      }
);


    // 2) Thumbnails
    const thumbFiles = formData.getAll("thumbnails").filter((f): f is File => f instanceof File);
    const thumbRes = await Promise.all(
      thumbFiles.map(async (file) => {
        const uri = await fileToDataUri(file);
        return cloudinary.uploader.upload(uri, {
          folder: `products-${env}/${safeCategory}/${myUUID}/thumbnails`,
          use_filename: true,
          unique_filename: true,
          resource_type: "image",
          transformation: [{ fetch_format: "auto", quality: "auto" }],
        });
      })
    );

    // 3) DIGITAL/PRINT deliverables
    let rawSvg: any | null = null;
    let svgFormatUrl: string | null = null;
    let svgPreviewUrl: string | null = null;
    let formatUploads: Array<{
      secure_url: string;
      public_id: string;
      resource_type: "image" | "raw" | string;
      format?: string;
      bytes?: number;
      width?: number;
      height?: number;
      type?: "upload" | "authenticated" | "private";
    }> = [];

    if (variantType !== "ORIGINAL") {
      const svgFile = formData.get("svg");
      if (svgFile && svgFile instanceof File) {
        const baseName = svgFile.name.replace(/\.[^/.]+$/, "");
        const svgUri = await fileToDataUri(svgFile);

        rawSvg = await cloudinary.uploader.upload(svgUri, {
          folder: `products-${env}/${safeCategory}/${myUUID}/svg`,
          use_filename: true,
          unique_filename: true,
          resource_type: "raw",
        });
        svgFormatUrl = rawSvg.secure_url;

        const previewSvg = await cloudinary.uploader.upload(svgUri, {
          folder: `products-${env}/${safeCategory}/${myUUID}/svg-preview`,
          public_id: baseName + "_preview",
          resource_type: "raw",
          use_filename: true,
          unique_filename: true,
        });
        svgPreviewUrl = previewSvg.secure_url;
      }

      const formatFiles = formData.getAll("formats").filter((f): f is File => f instanceof File);
      const otherFormats = formatFiles.filter((f) => f.type !== "image/svg+xml");

      formatUploads = await Promise.all(
        otherFormats.map(async (file) => {
          const uri = await fileToDataUri(file);
          const isPdf = file.type === "application/pdf";
          const up = await cloudinary.uploader.upload(uri, {
            folder: `products-${env}/${safeCategory}/${myUUID}/formats`,
            use_filename: true,
            unique_filename: true,
            resource_type: isPdf ? "raw" : "auto",
          });
          return up as any;
        })
      );
    }

    // 4) Category upsert
    const category = await db.category.upsert({
      where: { name: categoryName },
      create: { name: categoryName },
      update: {},
    });

    // 5) Create Product
    const requiresShipping = requiresShippingByKind(kind);
    const product = await db.product.create({
      data: {
        title,
        description,
        price,
        publicId: mainRes.public_id,
        thumbnails: [mainRes.secure_url, ...thumbRes.map((r) => r.secure_url)],
        formats: variantType !== "ORIGINAL" ? formatUploads.map((u) => u.secure_url) : [],
        svgFormat: variantType !== "ORIGINAL" ? svgFormatUrl : null,
        svgPreview: variantType !== "ORIGINAL" ? svgPreviewUrl : null,
        sizes: variantType !== "ORIGINAL" ? sizes : [],
        kind,
        requiresShipping,
        category: { connect: { id: category.id } },
      },
    });

    const preview = product.thumbnails?.[0] || svgPreviewUrl || null;

    // 6) Assets + Variants
    await db.$transaction(async (tx) => {
      // Save deliverables as ProductAsset
      if (variantType !== "ORIGINAL") {
        for (const up of formatUploads) {
          const ext = (up.format || extFromUrl(up.secure_url)).toLowerCase();
          await upsertProductAsset(tx, {
            productId: product.id,
            url: up.secure_url,
            storageKey: up.public_id,
            previewUrl: preview || undefined,
            ext,
            mimeType: mimeFromExt(ext),
            isVector: isVectorExt(ext),
            sizeBytes: up.bytes ?? undefined,
            width: up.width ?? undefined,
            height: up.height ?? undefined,
            resourceType: up.resource_type as "raw" | "image" | "video",
            deliveryType: (up.type as "upload" | "authenticated" | "private") ?? "upload",
          });
        }
      }

      // ORIGINAL meta if needed
      const originalMeta =
        variantType === "ORIGINAL"
          ? {
              widthIn: parseFloat(formData.get("widthIn")?.toString() || "0") || null,
              heightIn: parseFloat(formData.get("heightIn")?.toString() || "0") || null,
              depthIn: parseFloat(formData.get("depthIn")?.toString() || "0") || null,
              weightLb: parseFloat(formData.get("weightLb")?.toString() || "0") || null,
              year: parseInt(formData.get("year")?.toString() || "0", 10) || null,
              medium: formData.get("medium")?.toString() || null,
              surface: formData.get("surface")?.toString() || null,
              framed: (formData.get("framed")?.toString() || "false") === "true",
              sku: formData.get("sku")?.toString() || null,
            }
          : undefined;

      // Create variants according to kind
      await createVariantsForKind({
        tx,
        productId: product.id,
        kind,
        variantType,
        sizes,
        kindAttributes,
        originalMeta,
      });
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("POST /api/products/upload error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: "General Error", details: message }, { status: 500 });
  }
}
