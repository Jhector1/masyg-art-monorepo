// app/api/checkout/apply-edit-credits/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma";
// Prefer your shared client so the version is centralized:
import { stripe } from "@acme/core/lib/stripe"; // ensure this is configured with apiVersion: "2024-06-20"

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
  //   const { sessionId } = await req.json();
  //   if (!sessionId) {
  //     return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  //   }

  //   // Shared idempotency key used by BOTH this route and your webhook:
  //   const idemKey = `topup:${sessionId}`;

  //   const already = await prisma.webhookEvent.findUnique({ where: { id: idemKey } });
  //   if (already) return NextResponse.json({ applied: true, already: true });

  //   const session = await stripe.checkout.sessions.retrieve(sessionId);

  //   // Only apply for paid edit top-ups
  //   const isTopup =
  //     session.metadata?.kind === "quota_topup" && session.metadata?.quota === "edit";
  //   if (session.payment_status !== "paid" || !isTopup) {
  //     return NextResponse.json({ applied: false, reason: "not_edit_topup_or_unpaid" });
  //   }

  //   // Determine edits purchased from line items
  //   const items = await stripe.checkout.sessions.listLineItems(session.id, {
  //     expand: ["data.price"],
  //     limit: 100,
  //   });

  //   const edits = items.data.reduce((sum, li) => {
  //     const raw = (li.price?.metadata?.edits_per_unit as string) ?? "";
  //     const per = Number.parseInt(raw, 10);
  //     const safePer = Number.isFinite(per) ? per : 0;
  //     return sum + safePer * (li.quantity ?? 1);
  //   }, 0);

  //   if (edits <= 0) {
  //     return NextResponse.json({ applied: false, reason: "no_edits" });
  //   }

  //   const userId = session.metadata?.userId || null;
  //   const guestId = session.metadata?.guestId || null;
  //   const productId = session.metadata?.productId || null;
  //   if (!productId) {
  //     return NextResponse.json({ applied: false, reason: "missing_product" });
  //   }

  //   await prisma.$transaction(async (tx) => {
  //     // Mark processed using the shared key so webhook won't double-apply
  //     await tx.webhookEvent.create({ data: { id: idemKey } });

  //     const where = userId
  //       ? { userId_productId: { userId, productId } }
  //       : ({ guestId_productId: { guestId: guestId!, productId } } as any);

  //     await tx.userDesign.upsert({
  //       where,
  //       create: {
  //         userId,
  //         guestId,
  //         productId,
  //         style: {},          // minimal seed
  //         editQuota: edits,
  //         exportsUsed: 0,
  //         editsUsed: 0,
  //       },
  //       update: { editQuota: { increment: edits } },
  //     });
  //   });

    return NextResponse.json({ applied: true });
  } catch (err: any) {
    console.error("apply-edit-credits error:", err?.message || err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
