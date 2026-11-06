/** Read-only merchant order/customer queries. Status comes from canonical provider ledgers,
 * NEVER from merchant form fields. Every query scopes both organization and storefront. */
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess, validateTenantId, TenantAccessError } from "./tenancy";

const PAGE_SIZE = 25;
function pageNumber(input?: number): number {
  return Number.isSafeInteger(input) && input! >= 1 && input! <= 1000 ? input! : 1;
}
async function requireSensitiveStoreRead(userId: string, organizationId: string, storeId: string) {
  // Orders and customer PII must not be exposed to a generic MEMBER's read grant.
  const org = await requireMerchantAccess({ userId, organizationId, capability: "manage" });
  await requireMerchantAccess({ userId, organizationId: org.organizationId, storeId, capability: "read" });
  return { organizationId: org.organizationId, storeId: validateTenantId(storeId) };
}

export async function listMerchantOrders(args: { userId: string; organizationId: string; storeId: string; page?: number; status?: string }) {
  const scope = await requireSensitiveStoreRead(args.userId, args.organizationId, args.storeId);
  const page = pageNumber(args.page);
  const allowed = ["PENDING", "PAID", "FULFILLING", "FULFILLED", "CANCELLED", "REFUNDED"];
  const status = args.status && allowed.includes(args.status) ? args.status as typeof allowed[number] : undefined;
  const where = { ...scope, ...(status ? { status: status as "PENDING" | "PAID" | "FULFILLING" | "FULFILLED" | "CANCELLED" | "REFUNDED" } : {}) };
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, select: {
      id: true, status: true, currency: true, totalMinor: true, createdAt: true,
      customer: { select: { id: true, email: true, name: true } },
      _count: { select: { items: true } },
    }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getMerchantOrder(args: { userId: string; organizationId: string; storeId: string; orderId: string }) {
  const scope = await requireSensitiveStoreRead(args.userId, args.organizationId, args.storeId);
  const order = await prisma.order.findFirst({ where: { ...scope, id: validateTenantId(args.orderId) }, select: {
    id: true, status: true, currency: true, subtotalMinor: true, taxMinor: true, shippingMinor: true, totalMinor: true,
    shippingAddress: true, createdAt: true, updatedAt: true,
    customer: { select: { id: true, name: true, email: true } },
    items: { select: { id: true, titleSnapshot: true, skuSnapshot: true, fulfillment: true,
      attributesSnapshot: true, quantity: true, unitPriceMinor: true, totalMinor: true } },
    payments: { select: { id: true, provider: true, amountMinor: true, currency: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    shipments: { select: { id: true, status: true, trackingNumber: true, carrier: true, createdAt: true }, orderBy: { createdAt: "desc" } },
  } });
  if (!order) throw new TenantAccessError(404);
  return order;
}

export async function listMerchantCustomers(args: { userId: string; organizationId: string; storeId: string; page?: number }) {
  const scope = await requireSensitiveStoreRead(args.userId, args.organizationId, args.storeId);
  const page = pageNumber(args.page);
  const where = { organizationId: scope.organizationId, orders: { some: { storeId: scope.storeId } } };
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({ where, select: {
      id: true, email: true, name: true, createdAt: true,
      _count: { select: { orders: { where: { storeId: scope.storeId } } } },
    }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getMerchantCustomer(args: { userId: string; organizationId: string; storeId: string; customerId: string }) {
  const scope = await requireSensitiveStoreRead(args.userId, args.organizationId, args.storeId);
  const customer = await prisma.customer.findFirst({ where: {
    organizationId: scope.organizationId, id: validateTenantId(args.customerId),
    orders: { some: { storeId: scope.storeId } },
  }, select: { id: true, email: true, name: true, createdAt: true,
    orders: { where: { storeId: scope.storeId }, select: { id: true, status: true, totalMinor: true, currency: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 },
  } });
  if (!customer) throw new TenantAccessError(404);
  return customer;
}
