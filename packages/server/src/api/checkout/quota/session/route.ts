import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@acme/core/lib/stripe";
import { prisma } from "@acme/core/lib/prisma";
import { requireUser } from "@acme/core/utils/requireUser";

export const runtime = "nodejs";

const PACKS = {
  "10": { credits: 10, amountCents: 399 },
  "50": { credits: 50, amountCents: 1499 },
  "200": { credits: 200, amountCents: 3999 },
} as const;

type QuotaKind = "export" | "edit";
type PackKey = keyof typeof PACKS;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") return badRequest("invalid_json");

  const quota = (raw as any).quota as QuotaKind | undefined;
  const productId = String((raw as any).productId ?? "").trim();
  const packKey = (raw as any).packKey as PackKey | undefined;
  const quantityRaw = Number((raw as any).quantity ?? 1);

  if (quota !== "export" && quota !== "edit") {
    return badRequest("invalid_quota");
  }

  // Credits are product-scoped in DesignEntitlement. Never accept money for a
  // top-up that cannot be attached to a product and later consumed.
  if (!productId) return badRequest("product_id_required");

  if (!Number.isInteger(quantityRaw) || quantityRaw < 1 || quantityRaw > 200) {
    return badRequest("invalid_quantity");
  }

  const { id: userId } = await requireUser();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, site: true },
  });
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (quota === "export") {
    const pack = packKey ? PACKS[packKey] : null;
    if (!pack) return badRequest("invalid_pack");

    lineItems = [
      {
        price_data: {
          currency: "usd",
          unit_amount: pack.amountCents,
          product_data: {
            name: `${pack.credits} export credits`,
            metadata: { exports_per_unit: String(pack.credits) },
          },
        },
        quantity: 1,
      },
    ];
  } else {
    const unitCents = 49;
    lineItems = [
      {
        price_data: {
          currency: "usd",
          unit_amount: unitCents,
          product_data: {
            name: "Edit credits",
            metadata: { edits_per_unit: "1" },
          },
        },
        quantity: quantityRaw,
      },
    ];
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded",
    redirect_on_completion: "never",
    line_items: lineItems,
    metadata: {
      kind: "quota_topup",
      quota,
      productId,
      userId,
      site: product.site,
    },
    client_reference_id: `quota:${quota}:${userId}:${productId}`,
  });

  if (!session.client_secret) {
    throw new Error(`Embedded quota checkout ${session.id} has no client secret`);
  }

  return NextResponse.json({
    flow: "embedded",
    clientSecret: session.client_secret,
    sessionId: session.id,
  });
}
