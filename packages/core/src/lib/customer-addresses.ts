/** Buyer-owned saved shipping addresses. Merchant scoping is enforced on every query. */
import { prisma } from "@acme/core/lib/prisma";
import { z } from "zod";
import { resolvePublishedStore } from "./public-catalog";
import { validateTenantId } from "./tenancy";

export class CustomerAddressAccessError extends Error {
  constructor(public readonly status: 400 | 401 | 404 | 409, message = "Not found") {
    super(message);
    this.name = "CustomerAddressAccessError";
  }
}

export const customerAddressInput = z.object({
  label: z.string().trim().max(60).nullish(),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(30),
  country: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/).transform(v => v.toUpperCase()),
}).strict();

async function scope(args: { userId: string | null | undefined; storeId: string }) {
  if (!args.userId) throw new CustomerAddressAccessError(401, "Unauthorized");
  const store = await resolvePublishedStore(validateTenantId(args.storeId));
  return { organizationId: store.organizationId, storeId: store.id, userId: args.userId };
}

const publicAddressSelect = {
  id: true, label: true, street: true, city: true, state: true, postalCode: true,
  country: true, createdAt: true,
} as const;

export async function listCustomerAddresses(args: {userId: string | null | undefined; storeId: string}) {
  const where = await scope(args);
  const addresses = await prisma.customerAddress.findMany({
    where, select: publicAddressSelect, orderBy: {createdAt: "desc"}, take: 30,
  });
  return {addresses};
}

export async function createCustomerAddress(args: {
  userId: string | null | undefined; storeId: string; input: unknown;
}) {
  const parsed = customerAddressInput.safeParse(args.input);
  if (!parsed.success) throw new CustomerAddressAccessError(400, "Invalid address fields");
  const where = await scope(args);
  return prisma.$transaction(async tx => {
    // Constrain saved-address accumulation, including concurrent requests.
    const count = await tx.customerAddress.count({where});
    if (count >= 30) throw new CustomerAddressAccessError(409, "Address limit reached");
    const created = await tx.customerAddress.create({
      data: { ...where, ...parsed.data, label: parsed.data.label || null },
      select: {id: true},
    });
    return {ok: true, id: created.id};
  }, {isolationLevel: "Serializable", maxWait: 10000, timeout: 15000});
}

export async function deleteCustomerAddress(args: {
  userId: string | null | undefined; storeId: string; addressId: string;
}) {
  const where = await scope(args);
  const id = validateTenantId(args.addressId);
  const deleted = await prisma.customerAddress.deleteMany({where: {...where, id}});
  if (deleted.count !== 1) throw new CustomerAddressAccessError(404);
  return {ok: true};
}
