// File: src/app/api/orders/resend-email/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, VariantType } from "@prisma/client";
import { sendMail } from "@acme/core/lib/email";
import { stripe } from "@acme/core/lib/stripe"; // <-- make sure you export a configured Stripe instance

export const runtime = "nodejs";
const prisma = new PrismaClient();

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const TOKEN_TTL_HOURS = 168; // 7 days

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    const orderIdParam = url.searchParams.get("order");

    // optional JSON body: { "email": "someone@example.com" }
    let overrideEmail: string | null = null;
    try {
      const body = await req.json().catch(() => null);
      if (body && typeof body.email === "string") {
        overrideEmail = body.email.trim();
      }
    } catch {
      /* ignore bad JSON */
    }

    if (!sessionId && !orderIdParam) {
      return NextResponse.json({ error: "Provide session_id or order" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: sessionId ? { stripeSessionId: sessionId } : { id: orderIdParam! },
      include: {
        user: true,
        items: {
          where: { type: VariantType.DIGITAL },
          include: {
            product: { include: { assets: true } },
            digitalVariant: true,
          },
        },
        downloadTokens: { include: { asset: true } },
      },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // 1) choose recipient: override > user email > stripe session email
    let to =
      overrideEmail ||
      order.user?.email || null;
console.log(to);
    if (!to && order.stripeSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        to = session.customer_details?.email || session.customer_email || null;
      } catch (e) {
        console.warn("Stripe session lookup failed:", (e as Error).message);
      }
    }

    if (!to) {
      return NextResponse.json(
        { error: "No email available for this order. Pass { email } in body or ensure user/Stripe has an email." },
        { status: 400 }
      );
    }

    // 2) build list of assets (all assets of purchased DIGITAL products)
    const assets = order.items.flatMap((it) => it.product?.assets ?? []);
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const existingByAsset = new Map(order.downloadTokens.map((t) => [t.assetId, t]));

    const now = new Date();
    const expires = new Date(now.getTime() + TOKEN_TTL_HOURS * 3600 * 1000);

    // 3) ensure a token per asset
    const ensured = [];
    for (const asset of assets) {
      const existing = existingByAsset.get(asset.id);
      if (
        existing &&
        (!existing.expiresAt || existing.expiresAt > now) &&
        (existing.remainingUses == null || existing.remainingUses > 0)
      ) {
        ensured.push(existing);
        continue;
      }
      const lineItem = order.items.find((i) => i.productId === asset.productId) || null;
      const token = await prisma.downloadToken.create({
        data: {
          orderId: order.id,
          assetId: asset.id,
          orderItemId: lineItem?.id ?? null,
          userId: order.userId ?? null,
          guestId: order.guestId ?? null,
          // If you generate short-lived signed URLs per token, set signedUrl here.
          signedUrl: asset.url,
          expiresAt: expires,
          remainingUses: null,
          licenseSnapshot: lineItem?.digitalVariant?.license ?? null,
        },
      });
      ensured.push(token);
    }

    // 4) compose email
    const items = ensured.map((t) => {
      const a = assetById.get(t.assetId)!;
      const title =
        order.items.find((i) => i.productId === a.productId)?.product?.title ?? "Artwork";
      const ext = a.ext?.toUpperCase() || "FILE";
      const size = a.sizeBytes ? humanBytes(a.sizeBytes) : "—";
      const px = a.width && a.height ? `${a.width}×${a.height}px` : a.isVector ? "Vector" : "—";
      return {
        title,
        ext,
        size,
        px,
        href: `${BASE_URL}/api/downloads/${t.id}`,
      };
    });

// AFTER  ✅ (recommended)
const zipHref = `${BASE_URL}/api/downloads/archive?order=${order.id}`;
    const html = renderEmailHtml(items, zipHref);
    const text = renderEmailText(items, zipHref);

    await sendMail({
      to,
      subject: "Your digital downloads are ready",
      html,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resend-email error:", err);
    return NextResponse.json({ error: "Could not send email" }, { status: 500 });
  }
}

/* utils */
function humanBytes(b?: number) {
  if (!b || b <= 0) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${u[i]}`;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function renderEmailHtml(
  items: { title: string; ext: string; size: string; px: string; href: string }[],
  zipHref: string
) {
  const rows = items.map(
    (it) => `
    <div style="margin:12px 0;padding:12px;border:1px solid #eee;border-radius:12px">
      <div style="font-weight:600;font-size:15px;">${escapeHtml(it.title)}</div>
      <div style="color:#555;font-size:13px;margin-top:2px">
        ${it.ext} • ${it.px} • ${it.size}
      </div>
      <a href="${it.href}"
         style="display:inline-block;margin-top:8px;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:999px">
        Download
      </a>
    </div>`
  ).join("");
  return `
  <div style="font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
    <h2 style="margin:0 0 8px">Your digital downloads</h2>
    <p style="margin:0 0 16px;color:#555">Thanks for your purchase! Click a button below to download each file.</p>
    ${rows}
    <p style="margin-top:16px">
      <a href="${zipHref}"
         style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:999px">
        Download All (ZIP)
      </a>
    </p>
    <p style="color:#6b7280;font-size:12px;margin-top:12px">
      Links may expire; you can always re-request fresh links from your order page.
    </p>
  </div>`;
}
function renderEmailText(
  items: { title: string; ext: string; size: string; px: string; href: string }[],
  zipHref: string
) {
  const rows = items.map((it) => `• ${it.title} (${it.ext}, ${it.px}, ${it.size})\n  ${it.href}`).join("\n\n");
  return `Your digital downloads\n\n${rows}\n\nDownload All (ZIP): ${zipHref}\n`;
}
