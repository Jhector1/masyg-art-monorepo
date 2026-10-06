import { getServerSession } from "next-auth";
import { authOptions } from "@acme/auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const id = user && "id" in user ? String(user.id ?? "") : "";
  if (!user || !id) {
    throw new Error("Unauthorized");
  }
  return { ...user, id };
}
