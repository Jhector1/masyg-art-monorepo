// src/server/stripe/webhook/types.ts
import Stripe from "stripe";

export type QuotaKind = "edit" | "export";

export type CanonLineItem = {
  quantity: number;
  unitAmountCents: number; // computed from amounts/qty
  // merged metadata (price.metadata + product.metadata)
  productId?: string;
  variantType?: "DIGITAL" | "PRINT";
  digitalVariantId?: string | null;
  printVariantId?: string | null;
  cartItemId?: string | null;
  designId?: string | null;
  raw: Stripe.LineItem;
};
type SessionMeta = NonNullable<Stripe.Checkout.Session["metadata"]>;

export type CompletedSession =
  Omit<Stripe.Checkout.Session, "metadata"> & {
    metadata: SessionMeta & {
    kind?: "order" | "quota_topup";
    quota?: QuotaKind;
    userId?: string;
    guestId?: string;
    productId?: string;
    cartItemIds?: string; // optional csv
  };
};
