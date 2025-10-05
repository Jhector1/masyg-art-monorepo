// utils/handleCheckout.ts
import { loadStripe } from "@stripe/stripe-js";
import {
  ProductDetailResult,
  AddOptions,
  LicenseOption,
  FrameOption,
  MaterialOption,
  CartSelectedItem,
} from "../types";
import { getEffectiveSale } from "../lib/pricing";
import { SizeOption } from "@acme/ui/components/product/shared/core/SizeSelectorCore";


type CheckoutApiPayload = {
  flow?: "embedded" | "redirect";
  clientSecret?: string;
  url?: string;
  sessionId?: string;
  error?: string;
};

export type CheckoutResult =
  | { status: "auth_required" }
  | { status: "ok"; flow: "embedded"; clientSecret: string; cartItemId?: string }
  | { status: "ok"; flow: "redirect"; url: string; cartItemId?: string }
  | { status: "ok"; flow: "sessionId"; sessionId: string; cartItemId?: string }
  | { status: "error"; message: string };

export interface CheckoutProps {
  user: { id: string } | null;
  guestId: string | null;
  inCart: CartSelectedItem | undefined;
  addToCart: (
   productId: string,
    digitalType: string | null,
    printType: string | null,
    // price: number,
    //     originalPrice:number,

    format: string,
    size: string,
    material: string,
    frame: string,
    license: string,
    quantity?: number
  ) => Promise<any>;
  finalPrice: string;
  product: ProductDetailResult;
  options: AddOptions;
  format: string;
  size: SizeOption | null;
  material: MaterialOption;
  frame: FrameOption | null;
  license: LicenseOption;

  /** Optional UI hooks */
  setModalOpen?: (isOpen: boolean) => void;
  onPurchaseComplete?: () => void;
  exportHref?: string;

  /** If you prefer a direct callback instead of a window event */
  openEmbeddedExternally?: (clientSecret: string) => void;

  /**
   * Control whether this function opens UI (embedded/redirect) itself.
   * If false, it only returns the session info so the caller can handle UI.
   * Default: true
   */
  openUI?: boolean;
}

export async function handleCheckout({
  user,
  guestId,
  inCart,
  addToCart,
  product,
  options,
  format,
  size,
  material,
  frame,
  license,
  setModalOpen,
  finalPrice,
  exportHref,
  onPurchaseComplete,
  openEmbeddedExternally,
  openUI = true,
}: CheckoutProps): Promise<CheckoutResult> {
  // Require a user or guest id; otherwise show your auth modal
  if (!user && !guestId) {
    setModalOpen?.(true);
    return { status: "auth_required" };
  }

  // Ensure there's a cart line for this product
  let created: any = null;
  if (!inCart) {
    created = await addToCart(
      product.id,
      options.digital ? "Digital" : null,
      options.print ? "Print" : null,
      // Number(finalPrice),
      //   Number(finalPrice),
      format,
      size?.label||'',
      material?.label || "",
      frame?.label || "",
      license?.type || (license as any)?.id || "Standard",
      1
    );
  }

  const cartItemId = inCart?.cartItemId ?? created?.result?.cartItemId;
   const saleStartsAt = product?.saleStartsAt
    ? new Date(product.saleStartsAt as any)
    : null;
  const saleEndsAt = product?.saleEndsAt
    ? new Date(product.saleEndsAt as any)
    : null;
  const saleInfo = getEffectiveSale({
        price: Number(finalPrice),
        salePrice: product .salePrice ?? null,
        salePercent: product .salePercent ?? null,
        saleStartsAt: saleStartsAt,
        saleEndsAt:saleEndsAt,
     
      })
  const productItem = {
    quantity: 1,
    myProduct: {
      id: product.id,
      title: product.title,
      price: saleInfo.price,
      imageUrl: product.imageUrl,
      digital: options.digital
        ? { id: options.digitalVariantId || created?.result?.digitalVariantId, format, license }
        : undefined,
      print: options.print
        ? {
            id: options.printVariantId || created?.result?.printVariantId,
            format,
            size: size?.label,
            material: material.label,
            frame: frame?.label || "",
          }
        : undefined,
    },
    cartItemId,
  };

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cartProductList: [productItem] }),
  });

  const payload: CheckoutApiPayload = await res.json();
  if (!res.ok) {
    const message = payload.error || "Checkout session failed";
    // Don't throw—return a typed error so callers can handle it
    return { status: "error", message };
  }

  // EMBEDDED
  if (payload.flow === "embedded" && payload.clientSecret) {
    // Close whichever modal launched us (so we don't nest)
    setModalOpen?.(false);

    if (openUI) {
      if (openEmbeddedExternally) {
        openEmbeddedExternally(payload.clientSecret);
      } else {
        window.dispatchEvent(
          new CustomEvent("open-checkout", {
            detail: {
              clientSecret: payload.clientSecret,
              exportHref,
              onPurchaseComplete,
            },
          })
        );
      }
    }
    return { status: "ok", flow: "embedded", clientSecret: payload.clientSecret, cartItemId };
  }

  // REDIRECT URL (hosted Checkout)
  if (payload.flow === "redirect" && payload.url) {
    if (openUI) {
      window.location.href = payload.url;
    }
    return { status: "ok", flow: "redirect", url: payload.url, cartItemId };
  }

  // LEGACY sessionId flow
  if (payload.sessionId) {
    if (openUI) {
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) return { status: "error", message: "Stripe failed to load" };
      await stripe.redirectToCheckout({ sessionId: payload.sessionId });
    }
    return { status: "ok", flow: "sessionId", sessionId: payload.sessionId, cartItemId };
  }

  return { status: "error", message: "Unknown checkout flow" };
}