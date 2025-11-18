import { getPrisma } from "../adapters/prisma"

export const membershipRepo = {
  async listTiers() {
    return getPrisma().membershipTier.findMany({ orderBy: { createdAt: "asc" } })
  },
  async createTier(data: { level: "free" | "basic" | "premium" | "vip"; name: string; price: number; durationDays: number; maxPosts?: number; maxStorageMb?: number; features?: unknown }) {
    return getPrisma().membershipTier.create({ data: { ...data, features: data.features as any } })
  },
  async updateTier(id: number, data: Partial<{ name: string; price: number; durationDays: number; maxPosts: number; maxStorageMb: number; features: unknown }>) {
    return getPrisma().membershipTier.update({ where: { id }, data: { ...data, features: (data as any)?.features as any } })
  },
  async removeTier(id: number) {
    return getPrisma().membershipTier.delete({ where: { id } })
  },
  async assignMembership(userId: number, tierId: number, endDate: Date, meta?: { paymentMethod?: string; transactionId?: string }) {
    return getPrisma().userMembership.create({ data: { userId, tierId, endDate, paymentMethod: meta?.paymentMethod, transactionId: meta?.transactionId } })
  },
  async getActiveMembership(userId: number) {
    return getPrisma().userMembership.findFirst({ where: { userId, isActive: true, endDate: { gt: new Date() } }, orderBy: { endDate: "desc" } })
  },
  async deactivateMembership(id: number) {
    return getPrisma().userMembership.update({ where: { id }, data: { isActive: false } })
  },
}