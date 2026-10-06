import { prisma } from "../../../lib/prisma";
import { QuotaKind } from "./types";
import { listSessionLineItems, tryClaimIdempotencyTx } from "./utils";
import type Stripe from "stripe";
import { EntitlementSource } from "@prisma/client";

export function isQuotaTopup(session: Stripe.Checkout.Session) {
  return (
    session?.metadata?.kind === "quota_topup" &&
    (session?.metadata?.quota === "edit" || session?.metadata?.quota === "export")
  );
}

async function getQuotaUnits(sessionId: string, quota: QuotaKind) {
  const items = await listSessionLineItems(sessionId);
  const key = quota === "export" ? "exports_per_unit" : "edits_per_unit";

  return items.data.reduce((sum, lineItem) => {
    const price = lineItem.price as any;
    const product = price?.product as any;
    const fromPrice = Number.parseInt(price?.metadata?.[key] ?? "0", 10);
    const fromProduct = Number.parseInt(product?.metadata?.[key] ?? "0", 10);
    const per =
      Number.isFinite(fromPrice) && fromPrice > 0
        ? fromPrice
        : Number.isFinite(fromProduct) && fromProduct > 0
          ? fromProduct
          : 0;
    return sum + per * (lineItem.quantity ?? 1);
  }, 0);
}

export type QuotaTopupResult = {
  applied: boolean;
  deduped: boolean;
  units: number;
};

/**
 * Apply a paid quota checkout exactly once.
 *
 * The quota model is product-scoped, so missing identity/product metadata is a
 * hard failure. Silently acknowledging those sessions would mean accepting a
 * payment without granting the purchased credits.
 */
export async function handleQuotaTopup(
  session: Stripe.Checkout.Session
): Promise<QuotaTopupResult> {
  const quota = session.metadata?.quota as QuotaKind | undefined;
  if (quota !== "edit" && quota !== "export") {
    throw new Error(`Invalid quota metadata on session ${session.id}`);
  }

  const userId = session.metadata?.userId?.trim() || null;
  const guestId = session.metadata?.guestId?.trim() || null;
  const productId = session.metadata?.productId?.trim() || null;

  if (!productId) {
    throw new Error(`Missing productId on paid quota session ${session.id}`);
  }
  if (!userId && !guestId) {
    throw new Error(`Missing customer identity on paid quota session ${session.id}`);
  }
  if (session.payment_status !== "paid") {
    return { applied: false, deduped: false, units: 0 };
  }

  const units = await getQuotaUnits(session.id, quota);
  if (!Number.isInteger(units) || units <= 0) {
    throw new Error(`Invalid quota units on paid session ${session.id}`);
  }

  const idemKey = `topup:${session.id}`;
  let applied = false;

  await prisma.$transaction(async (tx) => {
    const claimed = await tryClaimIdempotencyTx(tx, idemKey);
    if (!claimed) return;

    // FK validation happens here too. If the product was deleted/corrupted,
    // throw and let Stripe retry instead of recording a successful webhook.
    await tx.designEntitlement.create({
      data: {
        userId: userId ?? undefined,
        guestId: userId ? undefined : guestId ?? undefined,
        productId,
        source: EntitlementSource.TOPUP,
        orderId: null,
        orderItemId: null,
        exportQuota: quota === "export" ? units : 0,
        editQuota: quota === "edit" ? units : 0,
        exportsUsed: 0,
        editsUsed: 0,
        expiresAt: null,
      },
    });

    applied = true;
  });

  return { applied, deduped: !applied, units };
}
