// services/admin/categories.ts
"use server";

import { prisma } from "@acme/core/lib/prisma";
import { z } from "zod";

const categorySchema = z.object({ name: z.string().min(2).max(100) });
export type CategoryInput = z.infer<typeof categorySchema>;

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });
}

export async function createCategory(input: CategoryInput) {
  const data = categorySchema.parse(input);
  return prisma.category.create({ data });
}

export async function updateCategory(id: string, input: CategoryInput) {
  const data = categorySchema.parse(input);
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  return prisma.category.delete({ where: { id } });
}
