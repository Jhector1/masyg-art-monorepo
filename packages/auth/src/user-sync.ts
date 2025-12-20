import {prisma} from "@acme/core/lib/prisma";

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
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, image: true },
  });

  return prisma.user.upsert({
    where: { email },
    update: {
      name: name ?? undefined,

      // ✅ only set image if DB image is NULL
      ...(existing?.image == null && image ? { image } : {}),

      ...(isAdminFromIdp ? { isAdmin: true } : {}),
    },
    create: {
      email,
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
