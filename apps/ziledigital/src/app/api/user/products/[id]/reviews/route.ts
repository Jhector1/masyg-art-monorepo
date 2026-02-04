// File: src/app/api/products/[id]/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@acme/core/lib/auth";
import { reviewsService } from "@acme/server/services/reviews.service";

// ─── Helper: require a valid session and return userId ────────────────
async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new NextResponse(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
    });
  }
  return session.user.id;
}

// ─── GET /api/products/[id]/reviews ───────────────────────────────────
// Public: fetch reviews for a given product
// export async function GET(
//   _req: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const productId = params.id;
//     const reviews = await reviewsService.listByProduct(productId);
//     return NextResponse.json(reviews);
//   } catch (e: any) {
//     return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 400 });
//   }
// }

// ─── POST /api/products/[id]/reviews ──────────────────────────────────
// Authenticated: add a review for the signed-in user
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;
    const userId = await requireUserId();

    const { rating, text } = await req.json();

    const created = await reviewsService.create({
      productId,
      userId,
      rating,
      text,
    });

    return NextResponse.json(created);
  } catch (e: any) {
    const msg = e?.message ?? "Failed";
    const status =
      msg === "Unauthorized" ? 403 :
      msg === "Not authenticated" ? 401 :
      400;

    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── DELETE /api/products/[id]/reviews ────────────────────────────────
// Authenticated: delete the signed-in user’s own review
export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { reviewId } = await req.json();

    const result = await reviewsService.deleteOwn({ reviewId, userId });
    return NextResponse.json(result);
  } catch (e: any) {
    const msg = e?.message ?? "Failed";
    const status =
      msg === "Unauthorized" ? 403 :
      msg === "Not authenticated" ? 401 :
      400;

    return NextResponse.json({ error: msg }, { status });
  }
}
