import { createHash } from "node:crypto";
import type Stripe from "stripe";
import type { Storefront } from "@prisma/client";

import { stripe } from "@acme/core/lib/stripe";

export type CheckoutActor = {
  userId?: string | null;
  guestId?: string | null;
};

export function checkoutIdempotencyKey(
  scope: string,
  parts: unknown[]
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
  return `${scope}:${digest}`;
}

export function resolveCheckoutBaseUrl(
  requestOrigin?: string | null
): string {
  const configured =
    process.env.NEXT_PUBLIC_CLIENT_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  const raw = configured || (process.env.NODE_ENV !== "production" ? requestOrigin : null);
  if (!raw) {
    throw new Error("Missing NEXT_PUBLIC_CLIENT_URL/NEXT_PUBLIC_APP_URL");
  }

  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Invalid checkout base URL protocol");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Production checkout base URL must use HTTPS");
  }

  return url.origin;
}

type ShippingCollection = NonNullable<
  Stripe.Checkout.SessionCreateParams["shipping_address_collection"]
>;
type AllowedCountry = ShippingCollection["allowed_countries"][number];

type CommonArgs = {
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  actor: CheckoutActor;
  site: Storefront;
  metadata?: Stripe.MetadataParam;
  requiresShipping?: boolean;
  allowedCountries?: AllowedCountry[];
  expiresAt?: number;
  idempotencyKey?: string;
  clientReferenceId?: string;
};

type EmbeddedArgs = CommonArgs & {
  flow: "embedded";
};

type RedirectArgs = CommonArgs & {
  flow: "redirect";
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutSessionArgs = EmbeddedArgs | RedirectArgs;

/**
 * One Stripe Checkout constructor for both storefronts and both UI modes.
 * Server-computed line items remain the source of truth; this function only
 * standardizes Stripe transport/security semantics.
 */
export async function createCheckoutSession(args: CreateCheckoutSessionArgs) {
  const metadata: Stripe.MetadataParam = {
    ...(args.metadata ?? {}),
    // Protected keys are written last so storefront callers cannot override
    // billing identity/tenant semantics through extra metadata.
    kind: "order",
    site: args.site,
    ...(args.actor.userId
      ? { userId: args.actor.userId }
      : args.actor.guestId
        ? { guestId: args.actor.guestId }
        : {}),
  };

  const common: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: args.lineItems,
    ...(args.requiresShipping
      ? {
          shipping_address_collection: {
            allowed_countries: args.allowedCountries ?? ["US", "CA", "GB", "FR"],
          },
        }
      : {}),
    consent_collection: { terms_of_service: "required" },
    automatic_tax: { enabled: true },
    metadata,
    client_reference_id:
      args.clientReferenceId ??
      `order:${args.actor.userId ?? args.actor.guestId ?? "guest"}`,
    ...(args.expiresAt ? { expires_at: args.expiresAt } : {}),
  };

  const requestOptions = args.idempotencyKey
    ? { idempotencyKey: args.idempotencyKey }
    : undefined;

  if (args.flow === "embedded") {
    const session = await stripe.checkout.sessions.create(
      {
        ...common,
        ui_mode: "embedded",
        redirect_on_completion: "never",
      },
      requestOptions
    );

    if (!session.client_secret) {
      throw new Error(`Embedded checkout ${session.id} has no client secret`);
    }

    return {
      flow: "embedded" as const,
      clientSecret: session.client_secret,
      sessionId: session.id,
      session,
    };
  }

  const session = await stripe.checkout.sessions.create(
    {
      ...common,
      payment_method_types: ["card"],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    },
    requestOptions
  );

  if (!session.url) {
    throw new Error(`Redirect checkout ${session.id} has no URL`);
  }

  return {
    flow: "redirect" as const,
    url: session.url,
    sessionId: session.id,
    session,
  };
}
