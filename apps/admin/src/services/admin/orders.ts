// services/admin/orders.ts
"use server";

import { prisma } from "@acme/core/lib/prisma";
import { z } from "zod";

export type ListOrdersInput = {
  q?: string;          // search by email, id
  status?: string;     // PENDING/PAID/SHIPPED/REFUNDED/etc. (free text in your schema)
  page?: number;
  pageSize?: number;
};

export async function listOrders({ q = "", status, page = 1, pageSize = 20 }: ListOrdersInput) {
  const where: any = {};
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { stripeSessionId: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        placedAt: true,
        status: true,
        total: true,
        stripeSessionId: true,
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: {
        select: {
          id: true,
          type: true,
          quantity: true,
          price: true,
          listPrice: true,
          product: { select: { id: true, title: true } },
          digitalVariant: { select: { id: true, format: true, license: true, size: true } },
          printVariant: { select: { id: true, size: true, material: true, frame: true } },
          originalVariant: { select: { id: true, sku: true, originalSerial: true } },
        },
      },
      payment: true,
      shipping: true,
      downloadTokens: { select: { id: true, assetId: true, signedUrl: true, expiresAt: true } },
    },
  });
}

const statusSchema = z.object({ status: z.string().min(2).max(32) });

export async function updateOrderStatus(id: string, next: { status: string }) {
  const data = statusSchema.parse(next);
  return prisma.order.update({ where: { id }, data });
}
