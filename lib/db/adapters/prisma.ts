import { PrismaClient } from "@prisma/client"

declare global {
  var __prisma: PrismaClient | undefined
}

export function getPrisma(): PrismaClient {
  if (!globalThis.__prisma) globalThis.__prisma = new PrismaClient()
  return globalThis.__prisma as PrismaClient
}

export async function prismaHealth(): Promise<{ ok: boolean }> {
  try {
    await getPrisma().$queryRaw`SELECT 1`
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
