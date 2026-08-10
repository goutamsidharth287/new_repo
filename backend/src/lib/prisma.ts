import { PrismaClient } from "@prisma/client";

// Prevents creating a new PrismaClient on every hot-reload in dev.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
