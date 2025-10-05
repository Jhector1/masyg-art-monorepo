// Re-export ALL Prisma types for consumers
export type * from "@prisma/client"; // TS 5+ "type export star"

// Optionally also re-export runtime bits:
export { PrismaClient } from "@prisma/client";

// Provide a shared Prisma singleton for Node/Next apps
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // log: ["query", "error", "warn"], // enable if you want
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
