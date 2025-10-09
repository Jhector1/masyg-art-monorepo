// services/admin/users.ts
"use server";

import { prisma } from "@acme/core/lib/prisma";

export type ListUsersInput = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function listUsers({ q = "", page = 1, pageSize = 20 }: ListUsersInput) {
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        downloadCount: true,
        _count: {
          select: {
            orders: true,
            favorites: true,
            reviews: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
