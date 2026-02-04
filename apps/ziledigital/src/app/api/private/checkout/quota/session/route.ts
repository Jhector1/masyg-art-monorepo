// app/api/checkout/quota/session/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@acme/core/lib/stripe";
import { requireUser } from "@acme/core/utils/requireUser";
import Stripe from "stripe";          // ✅ value import

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.json();
  const quota = raw.quota as "export" | "edit" | undefined;
  const productId = raw.productId as string | undefined;
  const packKey = raw.packKey as ("10" | "50" | "200") | undefined;
  const quantity = Number(raw.quantity ?? 1) || 1;

  const { id: userId } = await requireUser();

  // Your pack catalog (server authority)
  const PACKS = {
    "10":  { credits: 10, amountCents: 399 },
    "50":  { credits: 50, amountCents: 1499 },
    "200": { credits: 200, amountCents: 3999 },
  } as const;

  let line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (quota === "export") {
    const pack = packKey ? PACKS[packKey] : null;
    if (!pack) return NextResponse.json({ error: "invalid_pack" }, { status: 400 });

    line_items = [{
      price_data: {
        currency: "usd",
        unit_amount: pack.amountCents,
        product_data: {
          name: `${pack.credits} export credits`,
          metadata: { exports_per_unit: String(pack.credits) }, // count on product
        },
      },
      quantity: 1,
    }];
  } else if (quota === "edit") {
    // Example: 1 edit = $0.49 → buy N edits
    const unitCents = 49;
    line_items = [{
      price_data: {
        currency: "usd",
        unit_amount: unitCents,
        product_data: {
          name: `Edit credits`,
          metadata: { edits_per_unit: "1" },
        },
      },
      quantity, // N edits
    }];
  } else {
    return NextResponse.json({ error: "invalid_quota" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded",
    redirect_on_completion: "never",
    line_items,
    metadata: {
      kind: "quota_topup",
      quota: quota!,
      productId: productId ?? "",
      userId: userId ?? "",
    },
    client_reference_id: `quota:${quota}:${userId}:${productId ?? "none"}`,
  });

  return NextResponse.json({ clientSecret: session.client_secret, sessionId: session.id });
}

// type Stripe = typeof import("stripe") extends { default: infer T } ? T : never;
