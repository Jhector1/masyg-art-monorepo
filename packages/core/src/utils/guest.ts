import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth";
// import { cookies } from "next/headers";
// import { v4 as uuidv4 } from "uuid";

// export async function getCustomerId(): Promise<{ userId?: string; guestId?: string }> {
//   const session = await getServerSession(authOptions);

//   if (session?.user?.id) {
//     return { userId: session.user.id };
//   }

//   // ✅ Await the cookies() call
//   const cookieStore =  cookies(); // 🧠 fix is here

//   const guestId = cookieStore.get("guest_id")?.value;

// //   if (!guestId) {
// //     // guestId = uuidv4();
// //     // cookieStore.set("guest_id", guestId, {
// //     //   httpOnly: true,
// //     //   maxAge: 60 * 60 * 24 * 30, // 30 days
// //     //   sameSite: "lax",
// //     // });
// //     return;
// //   }

//   return { guestId };
// }



import { NextRequest } from "next/server";

export async function getCustomerIdFromRequest(req: NextRequest): Promise<{ userId?: string; guestId?: string }> {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) return { userId: session.user.id };

  const guestId = req.cookies.get("guest_id")?.value;
  return { guestId };
}
