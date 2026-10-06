import {prisma} from "@acme/db";

type SyncUserArgs = {
  email: string;
  name?: string | null;
  image?: string | null;
  isAdminFromIdp?: boolean;
};

export async function syncUserToDb({
  email,
  name,
  image,
  isAdminFromIdp,
}: SyncUserArgs) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, image: true },
  });

  return prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name: name ?? undefined,

      // ✅ only set image if DB image is NULL
      ...(existing?.image == null && image ? { image } : {}),

      ...(isAdminFromIdp ? { isAdmin: true } : {}),
    },
    create: {
      email: normalizedEmail,
      name: name ?? null,
      image: image ?? null,
      isAdmin: !!isAdminFromIdp,
      password: "", // OAuth-only user
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      isAdmin: true,
    },
  });
}
