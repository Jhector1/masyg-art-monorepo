// src/server/stripe/webhook/utils.ts
import Stripe from "stripe";
import { prisma } from "../../../lib/prisma";
import { stripe } from "../../../lib/stripe";
import { CanonLineItem } from "./types";
import { Prisma } from "@prisma/client";

export function isSessionCompleted(event: Stripe.Event) {
  return (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  );
}

// Idempotency helpers via WebhookEvent table
export async function alreadyProcessed(id: string) {
  return await prisma.webhookEvent.findUnique({ where: { id } });
}
export async function markProcessed(id: string) {
  try {
    await prisma.webhookEvent.create({ data: { id } });
  } catch {
    // ignore unique collisions
  }
}

export function mergePriceAndProductMeta(
  price: Stripe.Price | null | undefined
): Record<string, string> {
  const p = price as any;
  const prod = p?.product as any;
  const a = (p?.metadata ?? {}) as Record<string, string>;
  const b = (prod?.metadata ?? {}) as Record<string, string>;
  return { ...b, ...a };
}

export async function listSessionLineItems(sessionId: string): Promise<Stripe.ApiList<Stripe.LineItem>> {
  return await stripe.checkout.sessions.listLineItems(sessionId, {
    expand: ["data.price.product"],
    limit: 100,
  });
}

export function canonLineItems(items: Stripe.ApiList<Stripe.LineItem>): CanonLineItem[] {
  return items.data.map((li) => {
    const qty = li.quantity ?? 1;
    const amountSubtotal = li.amount_subtotal ?? li.amount_total ?? 0; // cents
    const unitAmountCents = qty > 0 ? Math.round(amountSubtotal / qty) : Math.round(amountSubtotal);

    const meta = mergePriceAndProductMeta(li.price as Stripe.Price | null);

    return {
      quantity: qty,
      unitAmountCents,
      productId: meta.productId || undefined,
      variantType: (meta.variantType as "DIGITAL" | "PRINT") || undefined,
      digitalVariantId: meta.digitalVariantId ?? null,
      printVariantId: meta.printVariantId ?? null,
      cartItemId: meta.cartItemId ?? null,
      designId: meta.designId ?? null,
      raw: li,
    };
  });
}

// Build a minimal fallback SVG if you ever need it
export function composeSvgFromDesign(style: any, defs?: string | null) {
  const defsBlock = defs ? `<defs>${defs}</defs>` : "";
  const meta = `<!-- style keys: ${Object.keys(style || {}).join(",")} -->`;
  return `<?xml version="1.0" encoding="UTF-8"?>${meta}
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    ${defsBlock}
    <rect width="100%" height="100%" fill="white"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="32" fill="#111">
      Purchased Design Preview
    </text>
  </svg>`;
}


export async function tryClaimIdempotencyTx(
  tx: Prisma.TransactionClient,
  idemKey: string
): Promise<boolean> {
  const res = await tx.webhookEvent.createMany({
    data: [{ id: idemKey }],
    skipDuplicates: true, // <-- avoids P2002 entirely
  });
  return res.count === 1;
}