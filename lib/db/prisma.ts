import { PrismaClient } from "@/prisma/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({} as any);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function ensureSeed() {
  const count = await prisma.user.count();
  if (count === 0) {
    await prisma.user.create({
      data: { email: "test@example.com", name: "First User" },
    });
  }
}

export async function listUsers() {
  return prisma.user.findMany();
}
