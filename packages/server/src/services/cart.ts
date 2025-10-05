import { prisma } from "@acme/core/lib/prisma";



import { normalizeTypes, } from "../utils/variants";
import { VariantType } from "packages/core/src/types";

/** Minimal price computation: prefer variant.listPrice else product.price; apply salePrice if present. */



async function getActiveCart(identity: Identity) {
  const { userId, guestId } = identity;
  if (!userId && !guestId) return null;
  return prisma.cart.findFirst({
    where: userId ? { userId } : { guestId },
  });
}

function whereByTypes(types?: VariantType[]) {
  if (!types || types.length === 0) return {};
  const ors: any[] = [];
  if (types.includes("DIGITAL")) ors.push({ digitalVariantId: { not: null } });
  if (types.includes("PRINT")) ors.push({ printVariantId: { not: null } });
  if (types.includes("ORIGINAL")) ors.push({ originalVariantId: { not: null } });
  // If somehow types had none of those, return nothing
  if (ors.length === 0) return { id: "__none__" };
  return { OR: ors };
}

/** List cart items with optional type filter and optional live design preview override. */
export async function listCartItemsForCustomer(
  identity: Identity & {
    types?: VariantType[] | string | null | undefined;
    liveDesignPreview?: boolean;
  }
) {
  const cart = await getActiveCart(identity);
  if (!cart) return [];

  const normalized = normalizeTypes(identity.types);
  const typeWhere = whereByTypes(normalized);

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id, ...(typeWhere as any) },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          price: true,
          salePrice: true,
          thumbnails: true,
        },
      },
      digitalVariant: { select: { id: true, listPrice: true, type: true } },
      printVariant: { select: { id: true, listPrice: true, type: true } },
      originalVariant: {
        select: {
          id: true,
          listPrice: true,
          type: true,
          status: true,
          inventory: true,
        },
      },
      design: {
        select: {
          id: true,
          previewUrl: true,
          previewUpdatedAt: true,
        },
      },
    },
    orderBy: { addedAt: "desc" },
  });

  // Optionally override preview with the user's latest saved design for that product
  let latestDesignByProduct: Record<string, { previewUrl: string | null } | undefined> = {};
  if (identity.liveDesignPreview) {
    const { userId, guestId } = identity;
    const productIds = [...new Set(items.map((i) => i.productId))];
    if (productIds.length) {
      const designs = await prisma.userDesign.findMany({
        where: {
          productId: { in: productIds },
          ...(userId ? { userId } : { guestId }),
        },
        select: { productId: true, previewUrl: true, updatedAt: true },
      });
      // pick most recent per product
      for (const pId of productIds) {
        const ds = designs.filter((d) => d.productId === pId);
        if (ds.length) {
          ds.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
          latestDesignByProduct[pId] = { previewUrl: ds[0].previewUrl ?? null };
        }
      }
    }
  }

  return items.map((it) => {
    // establish which variant is selected & compute unit price
    const selected =
      it.originalVariant ?? it.printVariant ?? it.digitalVariant ?? null;

    const unit = computeUnitPrice(
      { price: it.product.price, salePrice: it.product.salePrice ?? null },
      { listPrice: selected?.listPrice ?? null }
    );

    // choose preview: liveDesignPreview > snapshot > product thumb
    const live = identity.liveDesignPreview
      ? latestDesignByProduct[it.productId]?.previewUrl ?? null
      : null;

    const preview =
      live ??
      it.previewUrlSnapshot ??
      it.product.thumbnails?.[0] ??
      null;

    // normalize a compact payload
    return {
      cartItemId: it.id,
      productId: it.product.id,
      title: it.product.title,
      // which kind:
      kind: (selected?.type ?? null) as VariantType | null,
      variantId: selected?.id ?? null,
      quantity: it.quantity,
      // server-computed price (unit and extended)
      unitPrice: unit,
      lineTotal: unit * it.quantity,
      // availability echo for ORIGINAL
      originalStatus: it.originalVariant?.status ?? null,
      originalInventory: it.originalVariant?.inventory ?? null,
      // preview
      previewUrl: preview,
    };
  });
}










































/** Minimal price computation: prefer variant.listPrice else product.price; apply salePrice if present. */
function computeUnitPrice(p: { price: number; salePrice: number | null }, v?: { listPrice: number | null }) {
  const base = typeof v?.listPrice === "number" ? v.listPrice : p.price;
  if (typeof p.salePrice === "number" && p.salePrice < base) return p.salePrice;
  return base;
}

type Identity = { userId?: string; guestId?: string };

async function findOrCreateCart(identity: Identity) {
  const { userId, guestId } = identity;
  if (!userId && !guestId) throw new Error("Missing identity");

  const where = userId ? { userId } : { guestId };
  let cart = await prisma.cart.findFirst({ where });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId: userId ?? null, guestId: guestId ?? null } });
  }
  return cart;
}

/** Add ORIGINAL variant for a product (quantity fixed to 1 for originals). */
export async function addOriginalToCart(identity: Identity, productId: string) {
  const cart = await findOrCreateCart(identity);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      price: true,
      salePrice: true,
      thumbnails: true,
      variants: {
        where: { type: "ORIGINAL" },
        select: { id: true, listPrice: true, status: true, inventory: true },
      },
    },
  });
  if (!product) throw new Error("Product not found");

  const original = product.variants[0];
  if (!original) throw new Error("No ORIGINAL variant for this product");

  if (original.status === "SOLD" || (original.inventory ?? 1) < 1) {
    throw new Error("Original is not available");
  }

  // Make add idempotent: if already existed, just return
  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, originalVariantId: original.id },
  });
  if (existing) {
    return {
      result: {
        cartItemId: existing.id,
        digitalVariantId: null,
        printVariantId: null,
        originalVariantId: original.id,
      },
    };
  }

  const unit = computeUnitPrice(
    { price: product.price, salePrice: product.salePrice ?? null },
    { listPrice: original.listPrice ?? null }
  );

  const created = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId,
      originalVariantId: original.id,
      price: unit,
      originalPrice: unit,
      quantity: 1,
      previewUrlSnapshot: product.thumbnails?.[0] ?? null,
    },
    select: { id: true },
  });

  return {
    result: {
      cartItemId: created.id,
      digitalVariantId: null,
      printVariantId: null,
      originalVariantId: original.id,
    },
  };
}

/** Remove ORIGINAL entry for this product from the user's/guest's cart (idempotent). */
export async function removeOriginalFromCart(identity: Identity, productId: string) {
  const { userId, guestId } = identity;
  if (!userId && !guestId) return { ok: true };

  const cart = await prisma.cart.findFirst({ where: userId ? { userId } : { guestId } });
  if (!cart) return { ok: true };

  const originalVariant = await prisma.productVariant.findFirst({
    where: { productId, type: "ORIGINAL" },
    select: { id: true },
  });
  if (!originalVariant) return { ok: true };

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id, productId, originalVariantId: originalVariant.id },
  });
  return { ok: true };
}
