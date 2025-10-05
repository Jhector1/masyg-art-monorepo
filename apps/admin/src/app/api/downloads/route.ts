// import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
// import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { getCustomerIdFromRequest } from "@acme/core/utils/guest";
// import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  // const session = await getServerSession(authOptions);
  // const cookieStore = cookies();
  // const guestId = cookieStore.get("guestId")?.value;
  const {guestId, userId } =await getCustomerIdFromRequest(req);
  try {
    if (userId) {
      // ✅ Logged-in user
      const updated = await prisma.user.update({
        where:  { id: userId},
        data:   { downloadCount: { increment: 1 } },
        select: { downloadCount: true },
      });
      return NextResponse.json({ downloadCount: updated.downloadCount });
    }

    if (guestId) {
      // ✅ Guest — update cart's metadata or log download separately
      await prisma.cart.updateMany({
        where: { guestId },
        data:  { updatedAt: new Date() }, // or create a new guest log model
      });

      return NextResponse.json({ guestId, downloadCount: "tracked anonymously" });
    }

    return NextResponse.json({ error: "No user or guest ID found" }, { status: 401 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
