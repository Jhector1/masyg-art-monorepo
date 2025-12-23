export type CheckoutLineItem = {
  productId: string;
  quantity: number;
  productVariantId?: string | null;   // DIGITAL/PRINT
  originalVariantId?: string | null;  // ORIGINAL
};

export type CheckoutCreatePayload = {
  cartProductList: Array<{
    productId: string;
    quantity: number;
    productVariantId?: string | null;
    originalVariantId?: string | null;
  }>;
};

export type CheckoutCreateResponse = {
  url: string;
  message?: string;
  error?: string;
};

export async function createCheckoutSession(
  items: CheckoutLineItem[],
  opts?: { signal?: AbortSignal }
): Promise<CheckoutCreateResponse> {
  const payload: CheckoutCreatePayload = {
    cartProductList: items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      productVariantId: it.productVariantId ?? null,
      originalVariantId: it.originalVariantId ?? null,
    })),
  };

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
    signal: opts?.signal,
  });

  const out = (await res.json().catch(() => null)) as CheckoutCreateResponse | null;

  if (!res.ok) {
    const msg = out?.message ?? out?.error ?? (await res.text().catch(() => "")) ?? "Checkout failed";
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  if (!out?.url) throw new Error("Checkout failed: missing redirect url");
  return out;
}
