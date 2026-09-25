// src/__mocks__/@prisma/client.ts

// Enum-like value + type (matches Prisma style)
export const VariantType = {
  DIGITAL: 'DIGITAL',
  PRINT: 'PRINT',
} as const;

export type VariantType = typeof VariantType[keyof typeof VariantType];

// Minimal PrismaClient surface you use in tests. Keep transaction
// callback wiring separate so the initializer is not self-referential.
type MockDb = {
  order: { findFirst: jest.Mock; create: jest.Mock };
  orderItem: { create: jest.Mock };
  cartItem: { findMany: jest.Mock; deleteMany: jest.Mock };
  $transaction: jest.Mock;
  $disconnect: jest.Mock;
};

const base: MockDb = {
  order: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  orderItem: {
    create: jest.fn(),
  },
  cartItem: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
};

base.$transaction.mockImplementation(
  async (cb: (tx: MockDb) => unknown) => cb(base)
);

export class PrismaClient {
  order = base.order;
  orderItem = base.orderItem;
  cartItem = base.cartItem;
  $transaction = base.$transaction;
  $disconnect = base.$disconnect;
}

// If code imports `Prisma` for types, just give it a placeholder.
export const Prisma = {} as any;
