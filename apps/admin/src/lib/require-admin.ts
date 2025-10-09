import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  console.log(session)
  if (!session?.user) redirect("/api/auth/signin?callbackUrl=/admin");
  if (!(session.user as any).isAdmin) redirect("/");
  return session;
}
