// src/server/stripe/webhook/orders.ts
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";
import { canonLineItems, listSessionLineItems } from "./utils";
import { createPurchaseWebP } from "./cloudinaryHelper";
import { EntitlementSource, Prisma, VariantType } from "@prisma/client";
import { toJsonInput, toNullableJson } from "../../../utils/helpers";

const PURCHASE_EXPORT_CREDITS = 5;

type CanonicalLine = {
  productId: string;
  quantity: number;
  unitAmountCents: number;
  cartItemId?: string;
  variantType?: "DIGITAL" | "PRINT" | "BUNDLE";
  digitalVariantId?: string | null;
  printVariantId?: string | null;
  digitalUnitCents?: number;
  printUnitCents?: number;
  designId?: string | null;
};

type PreviewJob = {
  orderId: string;
  orderItemId: string;
  purchasedDesignId: string;
  userId: string | null;
  guestId: string | null;
  previewPublicId?: string | null;
  fallbackUrl?: string | null;
  style?: Prisma.InputJsonValue | null;
  defs?: Prisma.InputJsonValue | null;
};

// const toJsonInput = (
//   v: Prisma.JsonValue | null | undefined
// ): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull =>
//   v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue);

export async function handleOrderFulfillment(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId ?? null;
  const guestId = session.metadata?.guestId ?? null;
  if (!userId && !guestId) throw new Error("Missing customer identity");

  // Idempotency quick-exit (helps if a previous run fully completed)
  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true },
  });
  if (existing) return;

  // 1) Gather Stripe line items (outside tx)
  const items = await listSessionLineItems(session.id);
  const canonical = canonLineItems(items) as CanonicalLine[];
  const purchasedCartItemIds = canonical.map(c => c.cartItemId).filter(Boolean) as string[];

  // 2) Preload product fallback previews (outside tx)
  const productIds = [...new Set(canonical.map(c => c.productId))];
  const productPreviewRows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      thumbnails: true,
      assets: { select: { previewUrl: true, url: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  });
  const fallbackByProduct = new Map<string, string | null>(
    productPreviewRows.map(p => [
      p.id,
      p.thumbnails?.[0] ?? p.assets?.[0]?.previewUrl ?? p.assets?.[0]?.url ?? null,
    ])
  );

  // 3) Phase A (short tx): order + items + purchasedDesign stub + entitlements
  const previewJobs: PreviewJob[] = [];
  const { orderId } = await prisma.$transaction(
    async (tx) => {
      // Upsert for idempotency (requires @unique on stripeSessionId)
      const order = await tx.order.upsert({
        where: { stripeSessionId: session.id },
        update: {}, // no-op on retry
        create: {
          userId: userId ?? undefined,
          guestId: userId ? undefined : guestId!,
          total: (session.amount_total ?? 0) / 100,
          status: "COMPLETED",
          stripeSessionId: session.id,
        },
        select: { id: true },
      });

      for (const c of canonical) {
        const hasDigital = !!c.digitalVariantId;
        const hasPrint = !!c.printVariantId;
        const unitCents = c.unitAmountCents;

        const split = (() => {
          if (hasDigital && hasPrint) {
            if (
              typeof c.digitalUnitCents === "number" &&
              typeof c.printUnitCents === "number"
            ) {
              return { digital: c.digitalUnitCents, print: c.printUnitCents };
            }
            const half = Math.floor(unitCents / 2);
            return { digital: half, print: unitCents - half };
          }
          return { digital: hasDigital ? unitCents : 0, print: hasPrint ? unitCents : 0 };
        })();

        // Resolve design (DB-only) quickly
        const design =
          c.designId
            ? await tx.userDesign.findUnique({
                where: { id: c.designId },
                select: { id: true, style: true, defs: true, previewUrl: true, previewPublicId: true, productId: true },
              })
            : await tx.userDesign.findFirst({
                where: userId
                  ? { userId, productId: c.productId }
                  : { guestId: guestId!, productId: c.productId },
                orderBy: { updatedAt: "desc" },
                select: { id: true, style: true, defs: true, previewUrl: true, previewPublicId: true, productId: true },
              });

        // Initial snapshot to show in UIs (updated later if Cloudinary render succeeds)
        const initialPreview = design?.previewUrl ?? fallbackByProduct.get(c.productId) ?? null;

        const makeLine = async (variant: "DIGITAL" | "PRINT", cents: number) => {
          if (!cents) return;

          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: c.productId,
              type: variant as VariantType,
              price: cents / 100,
              quantity: c.quantity,
              digitalVariantId: variant === "DIGITAL" ? c.digitalVariantId ?? null : null,
              printVariantId: variant === "PRINT" ? c.printVariantId ?? null : null,
              // set snapshot immediately (can be improved post-commit)
              previewUrlSnapshot: initialPreview,
            },
            select: { id: true },
          });

          if (design) {
            // Create purchasedDesign stub (without heavy Cloudinary work)
            const purchased = await tx.purchasedDesign.create({
              data: {
                userId: userId ?? undefined,
                guestId: userId ? undefined : guestId ?? undefined,
                orderId: order.id,
                orderItemId: orderItem.id,
                productId: design.productId,
                style: toJsonInput(design.style),
                defs: toJsonInput(design.defs),
                svg: Prisma.JsonNull,
                previewUrl: initialPreview, // will be updated post-commit if render succeeds
              },
              select: { id: true },
            });

            // Entitlement immediately (fast write)
            await tx.designEntitlement.create({
              data: {
                userId: userId ?? undefined,
                guestId: userId ? undefined : guestId ?? undefined,
                productId: c.productId,
                userDesignId: design.id,
                purchasedDesignId: purchased.id,
                source: EntitlementSource.PURCHASE,
                orderId: order.id,
                orderItemId: orderItem.id,
                exportQuota: variant === "DIGITAL" ? PURCHASE_EXPORT_CREDITS : 0,
                editQuota: 0,
                exportsUsed: 0,
                editsUsed: 0,
                expiresAt: null,
              },
            });

            // Schedule post-commit Cloudinary render
            previewJobs.push({
              orderId: order.id,
              orderItemId: orderItem.id,
              purchasedDesignId: purchased.id,
              userId,
              guestId,
              previewPublicId: design.previewPublicId,
              fallbackUrl: design.previewUrl ?? fallbackByProduct.get(c.productId) ?? null,
              style: toNullableJson(design.style),
              defs: toNullableJson(design.defs),
            });
          } else {
            // No design: entitlement without purchasedDesign
            await tx.designEntitlement.create({
              data: {
                userId: userId ?? undefined,
                guestId: userId ? undefined : guestId ?? undefined,
                productId: c.productId,
                userDesignId: null,
                purchasedDesignId: null,
                source: EntitlementSource.PURCHASE,
                orderId: order.id,
                orderItemId: orderItem.id,
                exportQuota: variant === "DIGITAL" ? PURCHASE_EXPORT_CREDITS : 0,
                editQuota: 0,
                exportsUsed: 0,
                editsUsed: 0,
                expiresAt: null,
              },
            });
          }
        };

        if (hasDigital && hasPrint) {
          await makeLine("DIGITAL", split.digital);
          await makeLine("PRINT", split.print);
        } else if (hasDigital) {
          await makeLine("DIGITAL", split.digital);
        } else if (hasPrint) {
          await makeLine("PRINT", split.print);
        } else {
          // default to PRINT if variant info missing
          await makeLine("PRINT", unitCents);
        }
      }

      return { orderId: order.id };
    },
    { timeout: 15_000, maxWait: 10_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  );

  // 4) Phase B (post-commit): Cloudinary renders + preview updates (non-fatal)
  for (const job of previewJobs) {
    try {
      const { url } = await createPurchaseWebP({
        orderId: job.orderId,
        orderItemId: job.orderItemId,
        userId: job.userId ?? undefined,
        guestId: job.guestId ?? undefined,
        design: {
          previewPublicId: job.previewPublicId,
          previewUrl: job.fallbackUrl,
          style: job.style as any,
          defs: job.defs as any,
        },
      });
      const finalUrl = url ?? job.fallbackUrl ?? null;

      await prisma.$transaction(async (tx) => {
        await tx.purchasedDesign.update({
          where: { id: job.purchasedDesignId },
          data: { previewUrl: finalUrl },
        });
        await tx.orderItem.update({
          where: { id: job.orderItemId },
          data: { previewUrlSnapshot: finalUrl },
        });
      });
    } catch (e: any) {
      console.warn("Non-fatal preview render failure:", e?.message || e);
      // Keep initialPreview as-is; user still sees something.
    }
  }

  // 5) Post-commit cleanups (cart + download tokens)
  if (purchasedCartItemIds.length) {
    await prisma.cartItem.deleteMany({ where: { id: { in: purchasedCartItemIds } } });
  }

  // Build tokens with a single createMany
  const digitalItems = await prisma.orderItem.findMany({
    where: { orderId, type: "DIGITAL" },
    include: {
      product: { include: { assets: true } },
      digitalVariant: { select: { license: true } },
    },
  });

  if (digitalItems.length) {
    const now = Date.now();
    const guestExpiryMs = 7 * 24 * 60 * 60 * 1000;
    const userExpiryMs = 365 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now + (userId ? userExpiryMs : guestExpiryMs));

    const tokenRows = digitalItems.flatMap((item) =>
      (item.product?.assets ?? []).map((asset) => ({
        orderId,
        orderItemId: item.id,
        assetId: asset.id,
        userId: userId ?? undefined,
        guestId: userId ? undefined : guestId ?? undefined,
        signedUrl: asset.url, // TODO: replace with signed URL
        expiresAt,
        remainingUses: null as number | null,
        licenseSnapshot: item.digitalVariant?.license ?? "Personal",
      }))
    );

    if (tokenRows.length) {
      await prisma.downloadToken.createMany({ data: tokenRows, skipDuplicates: true });
    }
  }
}
