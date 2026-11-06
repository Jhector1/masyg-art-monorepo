import { prisma } from "@acme/core/lib/prisma";
import { hashGuestCartToken } from "@acme/auth/guestIdentity";
import type { Prisma } from "@prisma/client";
import { checkoutPreflightInput } from "./checkout-contract";
import { assessVariant } from "./cart-contract";
import {
  CommerceInvariantError, assertAttemptReplay, assertPaymentConnection,
  calculateTrustedOrderTotal, checkoutFingerprint, hashIdempotencyKey,
  planPhysicalStock,
} from "./commerce-invariants";
import { validateTenantId } from "./tenancy";

/** Internal, server-only coordinator. There is deliberately NO public route calling it.
 * The quotes/connection IDs below must come from trusted server components, never buyer JSON.
 * A prepared order is PENDING and has NOT been paid for or fulfilled.
 */
export type TrustedCheckoutQuote = {
  organizationId: string;
  storeId: string;
  reference: string;
  currency: string;
  cartFingerprint: string;
  taxMinor: number;
  shippingMinor: number;
  validUntil: Date;
};

export type CheckoutPreparation = {
  storeId: string;
  guestCartToken: string;
  contact: unknown;
  buyerUserId?: string; // verified by the server, not accepted from buyer JSON
  idempotencyKey: string;
  paymentConnectionId: string; // resolved by trusted server configuration, NOT a buyer field
  trustedQuote: TrustedCheckoutQuote; // server-verified tax/shipping quote, NOT a buyer field
};

const cartSelect = {
  id: true,
  items: {orderBy: {variantId: "asc" as const}, select: {
    quantity: true,
    variant: {select: {
      id: true, name: true, sku: true, attributes: true,
      fulfillment: true, inventoryPolicy: true, active: true,
      priceMinor: true, currency: true,
      inventory: {select: {locationId: true, onHand: true, reserved: true}},
      digitalFiles: {where: {retiredAt: null, asset: {private: true}}, select: {id: true}},
      product: {select: {title: true, status: true, offersDigitalLicenses:true, offersFraming:true, offersGlazing:true, listings: {
        where: {status: "PUBLISHED" as const}, select: {organizationId: true, storeId: true, status: true},
      }}},
    }},
  }},
} satisfies Prisma.CartSelect;

type CartData = Prisma.CartGetPayload<{select: typeof cartSelect}>;
type CartLine = CartData["items"][number];

type Contact = ReturnType<typeof checkoutPreflightInput.parse>;

/** Exact cart and destination binding for the tax/shipping quote provider. */
export function checkoutQuoteFingerprint(args: {
  organizationId: string;
  storeId: string;
  cartId: string;
  currency: string;
  shippingAddress: Contact["shippingAddress"];
  lines: readonly {variantId: string; quantity: number; priceMinor: number; currency: string}[];
}): string {
  return checkoutFingerprint({
    organizationId: args.organizationId,
    storeId: args.storeId,
    cartId: args.cartId,
    currency: args.currency,
    shippingAddress: args.shippingAddress ?? null,
    lines: [...args.lines].sort((a,b) => a.variantId.localeCompare(b.variantId)).map(l => ({
      variantId: l.variantId, quantity: l.quantity, priceMinor: l.priceMinor, currency: l.currency,
    })),
  });
}

function verifyTrustedQuote(
  quote: TrustedCheckoutQuote,
  args: {organizationId: string; storeId: string; currency: string; fingerprint: string; now: Date},
): void {
  if (quote.organizationId !== args.organizationId || quote.storeId !== args.storeId ||
      quote.currency !== args.currency || quote.cartFingerprint !== args.fingerprint ||
      typeof quote.reference !== "string" || !/^[A-Za-z0-9_:\/-]{8,160}$/.test(quote.reference) ||
      !(quote.validUntil instanceof Date) || !(quote.validUntil.getTime() > args.now.getTime()) ||
      quote.validUntil.getTime() > args.now.getTime() + 24*60*60*1000) {
    throw new CommerceInvariantError("QUOTE_STALE", "A current server-verified tax/shipping quote is required");
  }
}

function retryable(error: unknown): boolean {
  const code = (error as {code?: unknown})?.code;
  return code === "P2034" || code === "P2002";
}

async function serializableWithRetry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, {isolationLevel: "Serializable", timeout: 12000});
    } catch (error) {
      if (attempt === 2 || !retryable(error)) throw error;
    }
  }
  throw new CommerceInvariantError("TRANSACTION_CONFLICT", "Transaction retry budget exhausted");
}

function ensureLine(line: CartLine, organizationId: string, storeId: string): void {
  const v = line.variant;
  const safeVariant = {
    id: v.id, name: v.name, attributes:v.attributes, fulfillment: v.fulfillment, inventoryPolicy: v.inventoryPolicy,
    priceMinor: v.priceMinor, currency: v.currency, active: v.active, inventory: v.inventory,
    digitalFiles: v.digitalFiles, product: {
      id: "product", title: v.product.title, status: v.product.status, offersDigitalLicenses:v.product.offersDigitalLicenses,offersFraming:v.product.offersFraming,offersGlazing:v.product.offersGlazing,
      listings: v.product.listings.filter(l => l.organizationId === organizationId && l.storeId === storeId),
    },
  };
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
    throw new CommerceInvariantError("INVALID_QUANTITY", "Invalid cart quantity");
  }
  const issue = assessVariant(safeVariant, line.quantity);
  if (issue) throw new CommerceInvariantError("UNAVAILABLE_ITEM", `Variant unavailable: ${issue}`);
}

/** Requires a trusted quote; reads every purchasable fact again inside the transaction.
 * No Stripe session is created and no payment is captured.
 */
export async function prepareCheckoutAttempt(args: CheckoutPreparation) {
  const storeId = validateTenantId(args.storeId);
  const paymentConnectionId = validateTenantId(args.paymentConnectionId);
  const contact = checkoutPreflightInput.parse(args.contact);
  const guestHash = hashGuestCartToken(args.guestCartToken);
  const keyHash = hashIdempotencyKey(args.idempotencyKey);

  return serializableWithRetry(async tx => {
    const now = new Date();
    const store = await tx.storefront.findFirst({
      where: {id: storeId, published: true},
      select: {id: true, organizationId: true},
    });
    if (!store) throw new CommerceInvariantError("STORE_UNAVAILABLE", "Store not available");
    const organizationId = store.organizationId;
    const connection = await tx.integrationConnection.findFirst({
      where: {id: paymentConnectionId, organizationId},
      select: {id: true, organizationId: true, provider: true, accountRef: true,
        secretRef: true, capabilities: true, status: true, verifiedAt: true},
    });
    if (!connection) throw new CommerceInvariantError("PAYMENT_CONNECTION_UNAVAILABLE", "Merchant payment connection unavailable");
    assertPaymentConnection(organizationId, connection);

    const cart = await tx.cart.findFirst({
      where: {organizationId, storeId, guestTokenHash: guestHash}, select: cartSelect,
    });
    if (!cart || !cart.items.length || cart.items.length > 100) {
      throw new CommerceInvariantError("INVALID_CART", "Checkout cart is unavailable");
    }
    for (const line of cart.items) ensureLine(line, organizationId, storeId);
    const currency = cart.items[0].variant.currency;
    const includesPhysical = cart.items.some(l => l.variant.fulfillment === "PHYSICAL");
    if (includesPhysical && !contact.shippingAddress) {
      throw new CommerceInvariantError("SHIPPING_ADDRESS_REQUIRED", "Shipping address required");
    }
    const lines = cart.items.map(l => ({
      variantId: l.variant.id, quantity: l.quantity, priceMinor: l.variant.priceMinor, currency: l.variant.currency,
    }));
    const fingerprint = checkoutQuoteFingerprint({
      organizationId, storeId, cartId: cart.id, currency,
      shippingAddress: contact.shippingAddress, lines,
    });
    const amounts = calculateTrustedOrderTotal({
      currency, lines: lines.map(l => ({quantity:l.quantity,unitPriceMinor:l.priceMinor,currency:l.currency})),
      taxMinor: args.trustedQuote.taxMinor, shippingMinor: args.trustedQuote.shippingMinor,
      includesPhysical,
    });
    const requestFingerprint = checkoutFingerprint({
      organizationId, storeId, cartId: cart.id, connectionId: connection.id,
      email: contact.email.toLowerCase(), address: contact.shippingAddress ?? null,
      cartFingerprint: fingerprint, quoteReference: args.trustedQuote.reference,
      ...amounts,
    });
    const existing = await tx.checkoutAttempt.findUnique({
      where: {organizationId_storeId_idempotencyKeyHash: {organizationId, storeId, idempotencyKeyHash: keyHash}},
      select: {id: true, orderId: true, expiresAt: true, status: true, requestFingerprint: true, organizationId: true, storeId: true},
    });
    if (existing) {
      assertAttemptReplay(existing,{organizationId,storeId,requestFingerprint});
      if (existing.expiresAt <= now) throw new CommerceInvariantError("CHECKOUT_CLOSED", "Checkout attempt expired");
      return {attemptId: existing.id, orderId: existing.orderId, status: existing.status,
        expiresAt: existing.expiresAt, ...amounts, replay: true as const};
    }
    // An existing identical attempt can be resumed until its own expiry even if
    // the original tax/shipping quote has elapsed. Fresh attempts require a live quote.
    verifyTrustedQuote(args.trustedQuote, {organizationId,storeId,currency,fingerprint,now});
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const normalizedEmail = contact.email.toLowerCase();
    // A signed-in buyer must own the customer record used by the success page.
    // Refuse a conflicting identity instead of silently reassigning a paid customer's orders.
    if (args.buyerUserId) {
      validateTenantId(args.buyerUserId);
      const linked=await tx.customer.findUnique({
        where:{organizationId_email:{organizationId,email:normalizedEmail}},select:{userId:true},
      });
      if (linked?.userId && linked.userId !== args.buyerUserId)
        throw new CommerceInvariantError("CUSTOMER_OWNER_CONFLICT","Customer is linked to another buyer");
    }
    const customer = await tx.customer.upsert({
      where:{organizationId_email:{organizationId,email:normalizedEmail}},
      update:args.buyerUserId?{userId:args.buyerUserId}:{},
      create:{organizationId,email:normalizedEmail,...(args.buyerUserId?{userId:args.buyerUserId}:{})},
      select:{id:true},
    });
    const order = await tx.order.create({data: {
      organizationId,storeId,customerId:customer.id,status:"PENDING",
      ...amounts, shippingAddress: contact.shippingAddress ?? undefined,
    }, select: {id:true}});
    for (const line of cart.items) {
      const v = line.variant;
      const orderItem = await tx.orderItem.create({data: {
        organizationId,orderId:order.id,variantId:v.id,
        titleSnapshot: `${v.product.title} — ${v.name}`,
        skuSnapshot: v.sku, attributesSnapshot: v.attributes ?? undefined,
        fulfillment: v.fulfillment, quantity: line.quantity,
        unitPriceMinor: v.priceMinor, totalMinor: v.priceMinor * line.quantity,
      }, select:{id:true}});
      if (v.fulfillment === "DIGITAL") {
        // Freeze exact paid-for files now, before Stripe is contacted. Private
        // file IDs were read through organization-scoped cart/variant relations.
        if (v.digitalFiles.length === 0 ||
            new Set(v.digitalFiles.map(f => f.id)).size !== v.digitalFiles.length) {
          throw new CommerceInvariantError("DIGITAL_FILE_INVALID", "Digital purchase has no unique private files");
        }
        for (const file of v.digitalFiles) {
          await tx.orderDigitalFile.create({data:{
            organizationId, orderItemId: orderItem.id, digitalFileId: file.id,
          }});
        }
        continue;
      }
      if (v.digitalFiles.length !== 0) {
        throw new CommerceInvariantError("DIGITAL_FILE_INVALID", "Physical purchase cannot acquire digital files");
      }
      if (v.inventoryPolicy !== "TRACKED") continue;
      const allocations = planPhysicalStock(line.quantity, v.inventory);
      for (const allocation of allocations) {
        const level = v.inventory.find(l => l.locationId === allocation.locationId);
        if (!level) throw new CommerceInvariantError("STOCK_CHANGED", "Stock location changed");
        const incremented = await tx.inventoryLevel.updateMany({
          where: {organizationId,variantId:v.id,locationId:level.locationId,
            reserved:level.reserved,onHand:{gte:level.reserved+allocation.quantity}},
          data:{reserved:{increment:allocation.quantity}},
        });
        if (incremented.count !== 1) throw new CommerceInvariantError("STOCK_CHANGED", "Concurrent stock update");
        await tx.stockHold.create({data: {
          organizationId,orderItemId:orderItem.id,variantId:v.id,locationId:allocation.locationId,
          quantity:allocation.quantity,status:"HELD",expiresAt,
        }});
      }
    }
    const attempt = await tx.checkoutAttempt.create({data:{
      organizationId, storeId, orderId:order.id,connectionId:connection.id,
      idempotencyKeyHash:keyHash,requestFingerprint,status:"PREPARED",expiresAt,
    },select:{id:true}});
    return {attemptId:attempt.id,orderId:order.id,status:"PREPARED" as const,expiresAt,...amounts,replay:false as const};
  });
}

/** Expiration is safe ONLY before a provider session has been submitted.
 * SESSION_CREATED / PAID attempts are deliberately excluded pending verified provider reconciliation.
 */
export async function expireUnsubmittedCheckout(args: {
  organizationId: string; storeId: string; attemptId: string; now?: Date;
}) {
  const organizationId = validateTenantId(args.organizationId);
  const storeId = validateTenantId(args.storeId);
  const attemptId = validateTenantId(args.attemptId);
  const now = args.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new CommerceInvariantError("INVALID_DATE","Invalid expiry time");
  return serializableWithRetry(async tx => {
    const attempt = await tx.checkoutAttempt.findFirst({where: {
      id:attemptId,organizationId,storeId,status:"PREPARED",providerSessionId:null,expiresAt:{lte:now},
    },select:{id:true,orderId:true}});
    if (!attempt) return {released:false as const,holdsReleased:0};
    const pending = await tx.order.findFirst({
      where:{id:attempt.orderId,organizationId,storeId,status:"PENDING"},select:{id:true},
    });
    if (!pending) throw new CommerceInvariantError("ORDER_STATE_CONFLICT","Cannot release a non-pending order");
    const claimed = await tx.checkoutAttempt.updateMany({
      where:{id:attempt.id,organizationId,storeId,status:"PREPARED",providerSessionId:null,expiresAt:{lte:now}},
      data:{status:"EXPIRED"},
    });
    if (claimed.count !== 1) throw new CommerceInvariantError("CHECKOUT_STATE_CONFLICT","Checkout state changed");
    const holds = await tx.stockHold.findMany({where:{organizationId,status:"HELD",item:{orderId:attempt.orderId}},
      select:{id:true,variantId:true,locationId:true,quantity:true}});
    for (const hold of holds) {
      const changed = await tx.stockHold.updateMany({where:{id:hold.id,organizationId,status:"HELD"},data:{status:"RELEASED"}});
      if (changed.count !== 1) throw new CommerceInvariantError("STOCK_HOLD_CHANGED","Stock hold changed");
      const level = await tx.inventoryLevel.updateMany({
        where:{organizationId,variantId:hold.variantId,locationId:hold.locationId,reserved:{gte:hold.quantity}},
        data:{reserved:{decrement:hold.quantity}},
      });
      if (level.count !== 1) throw new CommerceInvariantError("STOCK_CHANGED","Reserved inventory changed");
    }
    const order = await tx.order.updateMany({where:{id:attempt.orderId,organizationId,storeId,status:"PENDING"},data:{status:"CANCELLED"}});
    if(order.count !== 1) throw new CommerceInvariantError("ORDER_STATE_CONFLICT","Order state changed");
    return {released:true as const,holdsReleased:holds.length};
  });
}
