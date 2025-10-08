// packages/server/src/services/admin/dashboard.ts
export async function getAdminDashboard() {
  const { prisma } = await import("@acme/db"); // ⬅ lazy import

  const [products, categories, users, orders, sales] = await prisma.$transaction([
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
  ]);

  // If total is Decimal | number, normalize to number for .toFixed()
  const total = sales._sum.total ? Number(sales._sum.total) : 0;

  return {
    productCount: products,
    categoryCount: categories,
    userCount: users,
    orderCount: orders,
    totalSales: total,
  };
}
