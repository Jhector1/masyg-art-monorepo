import { PrismaClient, User } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth"; // your NextAuth config

const db = new PrismaClient();

export async function requireUser(): Promise<User> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    const e: any = new Error("Unauthorized");
    e.status = 401;
    throw e;
  }
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    const e: any = new Error("User not found");
    e.status = 401;
    throw e;
  }
  return user; // -> has .id, .email, etc.
}
