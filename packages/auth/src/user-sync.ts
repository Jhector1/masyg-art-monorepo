import { prisma } from "@acme/db";

type SyncUserArgs = {
  email: string;
  name?: string | null;
  image?: string | null;
};

/** Sync an authenticated identity, never an administrative grant. */
export async function syncUserToDb({ email, name, image }: SyncUserArgs) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Invalid identity email");
  }

  // Only identities from trusted OAuth/credentials flows may call this function.
  // A user-selected profile image is not overwritten on subsequent sign-ins.
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { image: true },
  });
  return prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      ...(name != null ? { name } : {}),
      ...(existing?.image == null && image ? { image } : {}),
    },
    create: {
      email: normalizedEmail,
      name: name ?? null,
      image: image ?? null,
      passwordHash: null, // OAuth-only identity; no fake password.
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      updatedAt: true,
    },
  });
}
