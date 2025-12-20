// packages/db/src/index.ts
import { PrismaClient } from "@prisma/client";

// Re-export ALL Prisma *types*
export type * from "@prisma/client";

// Re-export PrismaClient (runtime)
export { PrismaClient };

// Prisma singleton
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
