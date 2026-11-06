import { prisma } from "@acme/core/lib/prisma";
import { validateTenantId } from "./tenancy";

/** Store- and buyer-scoped read of an existing provider checkout session.
 * A redirect to a success URL is NOT payment evidence; the order's canonical
 * server-settled status remains the sole status displayed to the buyer.
 */
export class CheckoutSessionAccessError extends Error {
  constructor(public readonly status: 400 | 401 | 404, message = "Not found") {
    super(message);
    this.name = "CheckoutSessionAccessError";
  }
}

export function requireProviderSessionId(value: unknown): string {
  if (typeof value !== "string" || value.length < 6 || value.length > 255 ||
      !/^[A-Za-z0-9_:-]+$/.test(value)) {
    throw new CheckoutSessionAccessError(400, "Invalid checkout session");
  }
  return value;
}

type Address = {label?: string | null; street: string; city: string;
  state: string; postalCode: string; country: string};

/** Never expose raw Json, arbitrary customer details, or provider identifiers. */
function safeAddress(source: unknown): Address | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const v=source as Record<string, unknown>;
  const needed=["street","city","state","postalCode","country"] as const;
  if (!needed.every(key=>typeof v[key]==="string" && (v[key] as string).length <= 200)) return null;
  return {
    label: typeof v.label === "string" ? v.label.slice(0, 60) : null,
    street: v.street as string, city: v.city as string,
    state: v.state as string, postalCode: v.postalCode as string,
    country: v.country as string,
  };
}

export async function getBuyerCheckoutSession(args: {
  userId: string | null | undefined; storeId: string; sessionId: string;
}) {
  if (!args.userId) throw new CheckoutSessionAccessError(401, "Unauthorized");
  const storeId=validateTenantId(args.storeId);
  const providerSessionId=requireProviderSessionId(args.sessionId);
  const store=await prisma.storefront.findFirst({
    where:{id:storeId,published:true},select:{organizationId:true},
  });
  if (!store) throw new CheckoutSessionAccessError(404);
  const attempt=await prisma.checkoutAttempt.findFirst({
    where:{
      organizationId:store.organizationId,storeId,providerSessionId,
      order:{customer:{is:{userId:args.userId}}},
    },
    select:{
      order:{select:{
        id:true,status:true,currency:true,totalMinor:true,createdAt:true,shippingAddress:true,
        items:{select:{id:true,titleSnapshot:true,fulfillment:true,quantity:true,totalMinor:true}},
      }},
    },
  });
  if (!attempt) throw new CheckoutSessionAccessError(404);
  const order=attempt.order;
  // No status transition, payment reconciliation, claim, or file issuance in a GET.
  return {
    id:order.id,
    status:order.status,
    currency:order.currency,
    totalMinor:order.totalMinor,
    placedAt:order.createdAt.toISOString(),
    shipping:safeAddress(order.shippingAddress),
    items:order.items.map(item=>({
      id:item.id,
      title:item.titleSnapshot,
      type:item.fulfillment,
      priceMinor:item.totalMinor,
      quantity:item.quantity,
    })),
    processing:order.status === "PENDING",
  };
}
