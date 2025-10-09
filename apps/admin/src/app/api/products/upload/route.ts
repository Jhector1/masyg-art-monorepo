
// File: src/app/api/products/upload/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import slugify from "slugify";
import crypto from "crypto";
import {
  upsertProductAsset,
  extFromUrl,
  mimeFromExt,
  isVectorExt,
} from "@acme/core/lib/productAssets";
import {auth} from '@/lib/auth'

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

export async function POST(request: Request) {
     const session = await auth();
        if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      
  try {
    const formData = await request.formData();

    const categoryName = formData.get("category")?.toString().trim();
    const title = formData.get("title")?.toString().trim() || "";
    const description = formData.get("description")?.toString().trim() || "";
    const price = parseFloat(formData.get("price")?.toString() || "0");
    const variantType = (formData.get("variantType")?.toString() ||
      "DIGITAL") as "DIGITAL" | "PRINT" | "ORIGINAL";
    const mainFile = formData.get("main");

    if (!categoryName || !mainFile || !(mainFile instanceof File)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const safeCategory = slugify(categoryName, { lower: true, strict: true });
    const myUUID = `${title}-${crypto.randomUUID()}`;

    // 1) MAIN (watermarked preview for listing)
    const mainUri = await fileToDataUri(mainFile);
    const mainRes = await cloudinary.uploader.upload(mainUri, {
      folder: `products-${env}/${safeCategory}/${myUUID}/main`,
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

    // 2) THUMBNAILS
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

    // 3) DIGITAL/PRINT: SVG + other deliverables
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

    // 4) Sizes (non-original only)
    const sizes =
      variantType !== "ORIGINAL"
        ? formData.getAll("sizes").map((s) => s.toString()).filter(Boolean)
        : [];

    // 5) Category upsert
    const category = await db.category.upsert({
      where: { name: categoryName },
      create: { name: categoryName },
      update: {},
    });

    // 6) Create Product (keep arrays for back-compat)
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
        sizes,
        category: { connect: { id: category.id } },
      },
    });

    const preview = product.thumbnails?.[0] || svgPreviewUrl || null;

    // 7) Assets and/or Variant creation
    await db.$transaction(async (tx) => {
      if (variantType !== "ORIGINAL") {
        // Optional: add SVG deliverable (commented out in your code)
        // if (rawSvg) {
        //   await upsertProductAsset(tx, {
        //     productId: product.id,
        //     url: rawSvg.secure_url,
        //     storageKey: rawSvg.public_id,
        //     previewUrl: preview,
        //     ext: "svg",
        //     mimeType: "image/svg+xml",
        //     isVector: true,
        //     sizeBytes: rawSvg.bytes ?? undefined,
        //     resourceType: rawSvg.resource_type as "raw" | "image" | "video",
        //     deliveryType: rawSvg.type as "upload" | "authenticated" | "private",
        //   });
        // }

        for (const up of formatUploads) {
          const ext = (up.format || extFromUrl(up.secure_url)).toLowerCase();
          await upsertProductAsset(tx, {
            productId: product.id,
            url: up.secure_url,
            storageKey: up.public_id,
            previewUrl: preview,
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
      } else {
        // ORIGINAL painting: create a single variant with physical metadata
        const widthIn = parseFloat(formData.get("widthIn")?.toString() || "0");
        const heightIn = parseFloat(formData.get("heightIn")?.toString() || "0");
        const depthIn = parseFloat(formData.get("depthIn")?.toString() || "0");
        const weightLb = parseFloat(formData.get("weightLb")?.toString() || "0");
        const year = parseInt(formData.get("year")?.toString() || "0", 10) || null;
        const medium = formData.get("medium")?.toString() || null;
        const surface = formData.get("surface")?.toString() || null;
        const framed = (formData.get("framed")?.toString() || "false") === "true";
        const sku = formData.get("sku")?.toString() || null;

        await tx.productVariant.create({
          data: {
            productId: product.id,
            type: "ORIGINAL",
            sku,
            inventory: 1,
            status: "ACTIVE",
            widthIn: widthIn || null,
            heightIn: heightIn || null,
            depthIn: depthIn || null,
            weightLb: weightLb || null,
            year,
            medium,
            surface,
            framed,
          },
        });

        // NOTE: we intentionally do NOT create ProductAsset deliverables for ORIGINAL.
        // (You can still add attachments later if desired.)
      }
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("POST /api/products/upload error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: "General Error", details: message }, { status: 500 });
  }
}
