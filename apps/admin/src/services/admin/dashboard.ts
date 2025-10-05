// packages/server/src/services/admin/dashboard.ts
import { prisma } from "@acme/db";
export async function getAdminDashboard() {
  const [products, categories, users, orders, sales] = await prisma.$transaction([
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
  ]);
  return {
    productCount: products,
    categoryCount: categories,
    userCount: users,
    orderCount: orders,
    totalSales: sales._sum.total ?? 0,
  };
}
