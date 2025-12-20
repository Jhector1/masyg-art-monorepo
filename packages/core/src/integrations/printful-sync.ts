// packages/core/integrations/printful-sync.ts
import { prisma } from "../lib/prisma";
import {
  FulfillmentProvider,
  ProductKind,
  VariantType,
} from "@prisma/client";

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY!;
const PRINTFUL_BASE_URL = "https://api.printful.com";

const MARKUP_BY_KIND: Record<ProductKind, number> = {
  MUG: 2.2,
  STICKER: 2.3,
  CARD: 2.0,
  BOOK_DIGITAL: 2.0,
  ART: 2.0,
  OTHER: 2.0,
};

function computeRetail(kind: ProductKind, base: number): number {
  const factor = MARKUP_BY_KIND[kind] ?? MARKUP_BY_KIND.OTHER;
  return Math.round(base * factor * 100) / 100;
}

function inferProductKind(name: string): ProductKind {
  const n = (name || "").toLowerCase();
  if (n.includes("mug")) return ProductKind.MUG;
  if (n.includes("sticker")) return ProductKind.STICKER;
  if (n.includes("card") || n.includes("greeting")) return ProductKind.CARD;
  if (n.includes("book") || n.includes("zine")) return ProductKind.BOOK_DIGITAL;
  return ProductKind.OTHER;
}

async function getOrCreatePrintfulCategory() {
  const name = "Printful Merch";
  return prisma.category.upsert({
    where: { name },
    create: { name },
    update: {},
  });
}

/**
 * Normalize whatever the admin typed (number, "#id", "id", "@external", "printful:id")
 * into the path segment that Printful expects.
 */
function normalizePrintfulId(raw: string | number): string {
  if (typeof raw === "number") return String(raw);

  let key = raw.trim();

  // strip "printful:" prefix if someone pasted our externalId
  key = key.replace(/^printful:/, "");

  // strip leading "#" that UI shows (e.g. "#6921000bbfe052")
  key = key.replace(/^#/, "");

  // numeric? -> treat as Sync Product ID
  if (/^\d+$/.test(key)) {
    return key; // /store/products/40396004
  }

  // otherwise treat as external_id -> must be prefixed with "@"
  if (!key.startsWith("@")) {
    key = `@${key}`;
  }
  return key; // /store/products/@6921000bbfe052
}

// ----------------- helper to sync ONE product -----------------





export async function syncPrintfulProductById(
  syncProductId: number | string
): Promise<void> {
  if (!PRINTFUL_API_KEY) throw new Error("PRINTFUL_API_KEY is not set");

  const category = await getOrCreatePrintfulCategory();
  const idPart = String(syncProductId).replace(/^#/, ""); // just in case
  const externalKey = `printful:${idPart}`;

  // 1) get details from Printful
  const detailRes = await fetch(
    `${PRINTFUL_BASE_URL}/store/products/${idPart}`,
    {
      headers: { Authorization: `Bearer ${PRINTFUL_API_KEY}` },
    }
  );

  if (!detailRes.ok) {
    const body = await detailRes.text();
    throw new Error(
      `Printful GET /store/products/${idPart} failed: ${detailRes.status} – ${body}`
    );
  }

  const detailJson = await detailRes.json();
  const syncProduct = detailJson.result?.sync_product;
  const syncVariants: any[] = detailJson.result?.sync_variants ?? [];

  const name: string =
    syncProduct?.name ?? `Printful Product #${syncProductId}`;
  const kind = inferProductKind(name);

  // 2) read existing product so we can merge/preserve fields
  const existing = await prisma.product.findUnique({
    where: { externalId: externalKey },
  });

  // 3) build thumbnails: merge existing + new, and drop the design source file
  const thumbSet = new Set<string>();

  if (Array.isArray(existing?.thumbnails)) {
    for (const t of existing.thumbnails) {
      if (t && t.startsWith("http")) thumbSet.add(t);
    }
  }

  const mainThumb: string | undefined = syncProduct?.thumbnail_url;
  if (mainThumb && mainThumb.startsWith("http")) thumbSet.add(mainThumb);

  for (const v of syncVariants) {
    if (!Array.isArray(v.files)) continue;

    for (const f of v.files) {
      // ignore the source design file (often printfile-preview)
      const candidates = [
        f.preview_url,
        f.thumbnail_url,
        f.image,
        f.image_url,
      ];

      for (const url of candidates) {
        if (typeof url === "string" && url.startsWith("http")) {
          // simple guard against the flat art asset if you want
          if (!url.includes("printfiles") && !url.includes("printfile")) {
            thumbSet.add(url);
          }
        }
      }
    }
  }

  const thumbnails = Array.from(thumbSet);

  // 4) decide description behavior
  const printfulDescription = syncProduct?.description ?? "";
  const existingDescription = existing?.description ?? "";

  // only let Printful set description if you don't already have one
  const newDescription =
    existingDescription.trim().length > 0
      ? existingDescription
      : printfulDescription;

  // 5) build updateData so we DON'T always overwrite description
  const updateData: any = {
    // allow Printful to update the kind & shipping flags
    kind,
    requiresShipping: true,
    thumbnails, // merged list
  };

  // only set description if it was empty before
  if (existingDescription.trim().length === 0 && printfulDescription) {
    updateData.description = newDescription;
  }

  // 6) upsert product
  const product = await prisma.product.upsert({
    where: { externalId: externalKey },
    create: {
      externalId: externalKey,
      categoryId: category.id,
      title: name,
      description: newDescription,
      price: existing?.price ?? 0,
      thumbnails,
      formats: [],
      sizes: [],
      publicId: externalKey,
      kind,
      requiresShipping: true,
      isCustomizable: false,
    },
    update: updateData,
  });

  // 7) upsert variants (unchanged from before)
  let minRetailForProduct: number | null = null;

  for (const v of syncVariants) {
    const variantId: number = v.variant_id;
    const retailFromPrintful = parseFloat(v.retail_price ?? "0") || 0;
    const baseCost = retailFromPrintful;
    const listPrice =
      baseCost > 0 ? computeRetail(kind, baseCost) : retailFromPrintful;

    if (listPrice > 0) {
      minRetailForProduct =
        minRetailForProduct == null
          ? listPrice
          : Math.min(minRetailForProduct, listPrice);
    }

    await prisma.productVariant.upsert({
      where: { printfulVariantId: variantId },
      create: {
        productId: product.id,
        type: VariantType.PRINT,
        listPrice: listPrice || null,
        baseCost: baseCost || null,
        requiresShipping: true,
        fulfillmentProvider: FulfillmentProvider.PRINTFUL,
        printfulVariantId: variantId,
        attributes: {
          name: v.name,
          size: v.size,
          color: v.color,
        },
      },
      update: {
        type: VariantType.PRINT,
        listPrice: listPrice || null,
        baseCost: baseCost || null,
        requiresShipping: true,
        fulfillmentProvider: FulfillmentProvider.PRINTFUL,
        attributes: {
          name: v.name,
          size: v.size,
          color: v.color,
        },
      },
    });
  }

  if (minRetailForProduct != null && minRetailForProduct > 0) {
    await prisma.product.update({
      where: { id: product.id },
      data: { price: minRetailForProduct },
    });
  }
}




















/**
 * Bulk sync (unchanged) – now just delegates to syncPrintfulProductByKey
 */
export async function syncPrintfulProducts(): Promise<number> {
  if (!PRINTFUL_API_KEY) throw new Error("PRINTFUL_API_KEY is not set");

  let offset = 0;
  const limit = 50;
  let totalProcessed = 0;

  while (true) {
    const listUrl = new URL(`${PRINTFUL_BASE_URL}/store/products`);
    listUrl.searchParams.set("offset", String(offset));
    listUrl.searchParams.set("limit", String(limit));

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${PRINTFUL_API_KEY}` },
    });

    if (!listRes.ok) {
      const body = await listRes.text();
      throw new Error(
        `Printful GET /store/products failed: ${listRes.status} – ${body}`
      );
    }

    const listJson = await listRes.json();
    const syncProducts: any[] = listJson.result ?? [];
    const paging = listJson.paging;
    const total = paging?.total ?? syncProducts.length;

    if (!syncProducts.length) break;

    for (const sp of syncProducts) {
      await syncPrintfulProductById(sp.id);
      totalProcessed += 1;
    }

    offset += syncProducts.length;
    if (offset >= (paging?.total ?? total)) break;
  }

  return totalProcessed;
}
